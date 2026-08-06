import Link from "next/link";
import {
  Activity,
  BadgeDollarSign,
  Factory,
  FileText,
  Printer,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  TitanBadge,
  TitanButton,
  TitanCard,
  TitanGrid,
  TitanList,
  TitanListItem,
  TitanMetric,
  TitanPage,
  TitanPageHeader,
  TitanTableFrame,
} from "@/components/ui";
import { FeatureCategory, PermissionKey } from "@prisma/client";
import OperationsCharts, { type OperationsChartPoint } from "@/components/OperationsCharts";
import { canAccessAllCustomers, customerRelationWhere, customerWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { money } from "@/lib/money";
import { userAllows } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export default async function Dashboard() {
  const actor = await requireFeature(FeatureCategory.DASHBOARD);
  const customerFilter = customerWhere(actor);
  const relationFilter = customerRelationWhere(actor);
  const canViewExpenses = await userAllows(actor.id, actor.role, PermissionKey.EXPENSES_VIEW);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 11);

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const upcomingEnd = endOfLocalDay(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

  const taskScope = canAccessAllCustomers(actor) ? {} : {
    OR: [
      { assignedToId: actor.id },
      { createdById: actor.id },
      { customer: { assignedToId: actor.id } },
      { assignedToId: null, customerId: null },
    ],
  };

  const eventScope = canAccessAllCustomers(actor) ? {} : {
    OR: [
      { assignedToId: actor.id },
      { createdById: actor.id },
      { customer: { assignedToId: actor.id } },
      { assignedToId: null, customerId: null },
    ],
  };

  const [customers, quotes, jobs, printers, materials, recentOrders, chartOrders, expenses, calendarEvents, tasks, dueOrders, recentActivity] = await Promise.all([
    db.customer.count({ where: customerFilter }),
    db.quote.count({ where: relationFilter }),
    db.productionJob.count({ where: { status: { in: ["QUEUED", "PRINTING", "QUALITY_CHECK"] }, order: relationFilter } }),
    db.printer.findMany({ where: { active: true }, include: { jobs: { where: { status: { in: ["QUEUED", "PRINTING", "QUALITY_CHECK"] } } } } }),
    db.material.findMany(),
    db.order.findMany({ where: relationFilter, orderBy: { createdAt: "desc" }, take: 6, include: { customer: true } }),
    db.order.findMany({ where: { ...relationFilter, createdAt: { gte: start } }, select: { createdAt: true, totalCents: true } }),
    canViewExpenses ? db.expense.findMany({ where: { incurredAt: { gte: start }, status: { not: "VOID" } }, select: { incurredAt: true, amountCents: true, taxCents: true } }) : Promise.resolve([]),
    db.calendarEvent.findMany({
      where: {
        AND: [
          eventScope,
          {
            OR: [
              { startAt: { gte: todayStart, lte: upcomingEnd } },
              { startAt: { lt: todayStart }, endAt: { gte: todayStart } },
            ],
          },
        ],
      },
      orderBy: { startAt: "asc" },
      take: 12,
    }),
    db.task.findMany({
      where: {
        ...taskScope,
        dueAt: { not: null, lte: upcomingEnd },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: 12,
    }),
    db.order.findMany({
      where: {
        ...relationFilter,
        dueDate: { not: null, lte: upcomingEnd },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
    }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const chartData: OperationsChartPoint[] = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const year = date.getFullYear(), month = date.getMonth();
    const monthOrders = chartOrders.filter((order) => order.createdAt.getFullYear() === year && order.createdAt.getMonth() === month);
    const monthExpenses = expenses.filter((expense) => expense.incurredAt.getFullYear() === year && expense.incurredAt.getMonth() === month);
    return {
      month: date.toLocaleDateString("en-CA", { month: "short" }),
      revenue: monthOrders.reduce((sum, order) => sum + order.totalCents, 0) / 100,
      expenses: monthExpenses.reduce((sum, expense) => sum + expense.amountCents + expense.taxCents, 0) / 100,
      orders: monthOrders.length,
    };
  });

  const totalRevenue = chartOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amountCents + expense.taxCents, 0);
  const lowMaterials = materials.filter((material) => material.gramsOnHand <= material.reorderAtGrams).slice(0, 6);

  const upcomingEvents = [
    ...calendarEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      date: event.startAt,
      type: event.eventType,
      overdue: false,
      today: event.startAt <= todayEnd && (event.endAt ?? event.startAt) >= todayStart,
    })),
    ...dueOrders.map((order) => ({
      id: `order-${order.id}`,
      title: `${order.number} due`,
      date: order.dueDate!,
      type: "ORDER",
      overdue: order.dueDate! < todayStart,
      today: order.dueDate! >= todayStart && order.dueDate! <= todayEnd,
    })),
  ].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.today !== b.today) return a.today ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  }).slice(0, 10);

  const upcomingTasks = tasks.map((task) => ({
    id: `task-${task.id}`,
    title: task.title,
    date: task.dueAt!,
    type: task.priority,
    overdue: task.dueAt! < todayStart,
    today: task.dueAt! >= todayStart && task.dueAt! <= todayEnd,
  })).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.today !== b.today) return a.today ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  }).slice(0, 10);

  const labelForItem = (item: { type: string; overdue: boolean; today: boolean }) => {
    if (item.overdue) return `OVERDUE · ${item.type}`;
    if (item.today) return `TODAY · ${item.type}`;
    return item.type;
  };

  const classForItem = (item: { overdue: boolean; today: boolean }) => {
    if (item.overdue) return "pill danger";
    if (item.today) return "pill good";
    return "muted";
  };

  return (
    <TitanPage>
      <TitanPageHeader
        title="Operations Dashboard"
        description="Your live business command centre for revenue, customers, quotes, production, printers, inventory, and upcoming work."
        actions={
          <>
            <TitanBadge tone="success">System online</TitanBadge>
            <TitanButton href="/quotes" variant="primary">
              Create quote
            </TitanButton>
          </>
        }
      />

      <TitanGrid variant="metrics">
        <TitanMetric
          label="Total revenue · 12 months"
          value={money(totalRevenue)}
          icon={<BadgeDollarSign size={19} />}
          footer={<span>{chartOrders.length} completed and active orders</span>}
          accent="#1286d4"
        />
        <TitanMetric
          label="Orders · 12 months"
          value={chartOrders.length}
          icon={<ShoppingCart size={19} />}
          footer={<span>Track fulfillment and delivery</span>}
          accent="#6757f5"
        />
        <TitanMetric
          label="Active production"
          value={jobs}
          icon={<Factory size={19} />}
          footer={<span>Queued, printing, and quality check</span>}
          accent="#e79a18"
        />
        <TitanMetric
          label="Printers online"
          value={printers.length}
          icon={<Printer size={19} />}
          footer={<span>Connected production equipment</span>}
          accent="#12a875"
        />
        <TitanMetric
          label="Customers"
          value={customers}
          icon={<Users size={19} />}
          footer={<span>CRM profiles available to you</span>}
          accent="#1786d9"
        />
        <TitanMetric
          label="Quotes"
          value={quotes}
          icon={<FileText size={19} />}
          footer={<span>Draft, sent, approved, and declined</span>}
          accent="#9a59db"
        />
        {canViewExpenses ? (
          <TitanMetric
            label="Expenses · 12 months"
            value={money(totalExpenses)}
            icon={<Activity size={19} />}
            footer={<span>Visible with your accounting permission</span>}
            accent="#dd4f63"
          />
        ) : null}
      </TitanGrid>

      <TitanCard
        title="Business performance"
        description="Revenue, expenses, and order activity over the last 12 months."
        actions={
          <TitanButton href="/reports" variant="secondary" size="small">
            Open reports
          </TitanButton>
        }
      >
        <OperationsCharts data={chartData} showExpenses={canViewExpenses} />
      </TitanCard>

      <TitanGrid variant="three">
        <TitanCard
          title="Inventory alerts"
          description="Materials that have reached their reorder level."
          actions={
            <TitanButton href="/inventory" variant="secondary" size="small">
              View inventory
            </TitanButton>
          }
        >
          <TitanList>
            {lowMaterials.map((material) => (
              <TitanListItem
                key={material.id}
                title={`${material.name} ${material.colour || ""}`}
                meta="Low stock"
                aside={
                  <TitanBadge tone="warning">
                    {material.gramsOnHand.toFixed(0)} g
                  </TitanBadge>
                }
              />
            ))}
            {!lowMaterials.length ? (
              <TitanListItem
                title="Inventory levels look good"
                meta="No low-stock alerts"
                aside={<TitanBadge tone="success">Ready</TitanBadge>}
              />
            ) : null}
          </TitanList>
        </TitanCard>

        <TitanCard
          title="Today and upcoming"
          description="Events and orders scheduled over the next 30 days."
          actions={
            <TitanButton href="/calendar" variant="secondary" size="small">
              Calendar
            </TitanButton>
          }
        >
          <TitanList>
            {upcomingEvents.map((item) => (
              <TitanListItem
                key={item.id}
                title={item.title}
                meta={labelForItem(item)}
                aside={item.date.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            ))}
            {!upcomingEvents.length ? (
              <TitanListItem
                title="No scheduled events"
                meta="Nothing is due in the next 30 days"
              />
            ) : null}
          </TitanList>
        </TitanCard>

        <TitanCard
          title="Recent activity"
          description="The latest important actions recorded in TITAN."
          actions={
            <TitanButton href="/activity" variant="secondary" size="small">
              View all
            </TitanButton>
          }
        >
          <TitanList>
            {recentActivity.map((event) => (
              <TitanListItem
                key={event.id}
                title={event.action.replaceAll("_", " ")}
                meta={event.summary}
                aside={event.createdAt.toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                })}
              />
            ))}
          </TitanList>
        </TitanCard>
      </TitanGrid>

      <TitanGrid variant="two">
        <TitanCard
          title="Tasks due and upcoming"
          description="Overdue work and tasks due during the next 30 days."
          actions={
            <TitanButton href="/tasks" variant="secondary" size="small">
              View tasks
            </TitanButton>
          }
        >
          <TitanList>
            {upcomingTasks.map((item) => (
              <TitanListItem
                key={item.id}
                title={item.title}
                meta={labelForItem(item)}
                aside={item.date.toLocaleString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            ))}
            {!upcomingTasks.length ? (
              <TitanListItem
                title="No urgent tasks"
                meta="Your upcoming task list is clear"
                aside={<TitanBadge tone="success">Clear</TitanBadge>}
              />
            ) : null}
          </TitanList>
        </TitanCard>

        <TitanCard
          title="Quick actions"
          description="Start the most common TITAN workflows."
        >
          <div className="versionFourQuickActions">
            <TitanButton href="/customers" variant="secondary" full>
              Customers
            </TitanButton>
            <TitanButton href="/quotes" variant="primary" full>
              Create quote
            </TitanButton>
            <TitanButton href="/production" variant="secondary" full>
              Production
            </TitanButton>
            <TitanButton href="/assistant" variant="secondary" full>
              TITAN AI
            </TitanButton>
          </div>
        </TitanCard>
      </TitanGrid>

      <TitanCard
        title="Recent orders"
        description="The newest orders available to your profile."
        actions={
          <TitanButton href="/orders" variant="secondary" size="small">
            View all orders
          </TitanButton>
        }
      >
        <TitanTableFrame>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href="/orders">{order.number}</Link>
                  </td>
                  <td>{order.customer.name}</td>
                  <td>
                    <TitanBadge tone="info">{order.status}</TitanBadge>
                  </td>
                  <td>{money(order.totalCents)}</td>
                </tr>
              ))}
              {!recentOrders.length ? (
                <tr>
                  <td colSpan={4}>No orders are available to this profile.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TitanTableFrame>
      </TitanCard>
    </TitanPage>
  );
}
