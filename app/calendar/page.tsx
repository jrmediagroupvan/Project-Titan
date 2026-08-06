import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/app/actions";
import ConfirmDelete from "@/components/ConfirmDelete";
import { canAccessAllCustomers, customerRelationWhere, customerWhere } from "@/lib/customer-access";
import { db } from "@/lib/db";
import { requirePermission, userAllows } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dateTimeLocal = (date: Date | null) => date ? date.toISOString().slice(0, 16) : "";

export default async function CalendarPage({ searchParams }: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const actor = await requirePermission(PermissionKey.TASKS_VIEW);
  const query = await searchParams;
  const now = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(query.month || "");
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));
  const calendarStart = new Date(monthStart);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - calendarStart.getUTCDay());
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setUTCDate(calendarEnd.getUTCDate() + (6 - calendarEnd.getUTCDay()));
  const fullAccess = canAccessAllCustomers(actor);
  const eventScope = fullAccess ? {} : {
    OR: [{ assignedToId: actor.id }, { customer: { assignedToId: actor.id } }, { createdById: actor.id }],
  };
  const taskScope = fullAccess ? {} : {
    OR: [{ assignedToId: actor.id }, { customer: { assignedToId: actor.id } }],
  };
  const [events, tasks, orders, customers, users, canCreate, canEdit, canDelete] = await Promise.all([
    db.calendarEvent.findMany({
      where: { ...eventScope, startAt: { gte: calendarStart, lt: calendarEnd } },
      include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
    db.task.findMany({
      where: { ...taskScope, dueAt: { gte: calendarStart, lt: calendarEnd }, status: { notIn: ["DONE", "CANCELLED"] } },
      include: { customer: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
    }),
    db.order.findMany({
      where: { ...customerRelationWhere(actor), dueDate: { gte: calendarStart, lt: calendarEnd }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.customer.findMany({ where: customerWhere(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    userAllows(actor.id, actor.role, PermissionKey.TASKS_CREATE),
    userAllows(actor.id, actor.role, PermissionKey.TASKS_EDIT),
    userAllows(actor.id, actor.role, PermissionKey.TASKS_DELETE),
  ]);
  const previous = new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString().slice(0, 7);
  const monthLabel = monthStart.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
  const days: Date[] = [];
  for (let cursor = new Date(calendarStart); cursor < calendarEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(new Date(cursor));
  }

  return (
    <>
      <div className="top">
        <div><h1>Calendar</h1><p className="muted">Events, task deadlines, customer commitments, and order due dates in one place.</p></div>
        <div className="calendarNav"><Link className="secondary small" href={`/calendar?month=${previous}`}>←</Link><b>{monthLabel}</b><Link className="secondary small" href={`/calendar?month=${next}`}>→</Link></div>
      </div>
      {query.error && <p className="alert">Calendar operation failed: {query.error.replaceAll("-", " ")}.</p>}
      <div className="calendarWeekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div key={day}>{day}</div>)}</div>
      <section className="calendarGrid">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = events.filter((event) => dateKey(event.startAt) === key);
          const dayTasks = tasks.filter((task) => task.dueAt && dateKey(task.dueAt) === key);
          const dayOrders = orders.filter((order) => order.dueDate && dateKey(order.dueDate) === key);
          return <article className={`calendarDay ${day.getUTCMonth() !== monthIndex ? "outside" : ""} ${key === dateKey(now) ? "today" : ""}`} key={key}>
            <div className="calendarDate">{day.getUTCDate()}</div>
            {dayEvents.map((event) => <div className="calendarItem" style={{ borderLeftColor: event.colour }} key={event.id}><b>{event.allDay ? "" : event.startAt.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })} {event.title}</b><span>{event.customer?.name || event.assignedTo?.name || event.eventType}</span></div>)}
            {dayTasks.map((task) => <div className="calendarItem taskItem" key={task.id}><b>Task · {task.title}</b><span>{task.customer?.name || task.priority}</span></div>)}
            {dayOrders.map((order) => <div className="calendarItem orderItem" key={order.id}><b>Due · {order.number}</b><span>{order.customer.name}</span></div>)}
          </article>;
        })}
      </section>

      <div className="two section">
        <section className="card">
          <h2>Events this month</h2>
          {events.map((event) => <details className="record" key={event.id}>
            <summary><b>{event.title}</b> <span className="muted">{event.startAt.toLocaleString("en-CA")} · {event.eventType}</span></summary>
            {canEdit ? <form action={updateCalendarEvent} className="form editForm">
              <input type="hidden" name="id" value={event.id} />
              <input name="title" defaultValue={event.title} required />
              <textarea name="description" defaultValue={event.description || ""} />
              <div className="formRow"><label>Starts<input name="startAt" type="datetime-local" defaultValue={dateTimeLocal(event.startAt)} required /></label><label>Ends<input name="endAt" type="datetime-local" defaultValue={dateTimeLocal(event.endAt)} /></label></div>
              <div className="formRow"><label>Type<select name="eventType" defaultValue={event.eventType}>{["GENERAL","MEETING","PRODUCTION","DELIVERY","MAINTENANCE","CUSTOMER"].map((type) => <option key={type}>{type}</option>)}</select></label><label>Colour<input name="colour" type="color" defaultValue={event.colour} /></label></div>
              <div className="formRow"><label>Customer<select name="customerId" defaultValue={event.customerId || ""}><option value="">No customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Assigned to<select name="assignedToId" defaultValue={event.assignedToId || ""}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div>
              <label className="check"><input name="allDay" type="checkbox" defaultChecked={event.allDay} /> All-day event</label>
              <div className="actions"><button className="button small">Save event</button>{canDelete && <ConfirmDelete action={deleteCalendarEvent} id={event.id} message={`Delete ${event.title}?`}>Delete</ConfirmDelete>}</div>
            </form> : <p>{event.description || "No description."}</p>}
          </details>)}
          {!events.length && <p className="muted">No calendar events this month. Task and order deadlines still appear in the month view.</p>}
        </section>
        {canCreate && <form action={createCalendarEvent} className="card form">
          <h2>Add calendar event</h2>
          <label>Title<input name="title" required placeholder="Production planning" /></label>
          <label>Description<textarea name="description" rows={3} /></label>
          <div className="formRow"><label>Starts<input name="startAt" type="datetime-local" required /></label><label>Ends<input name="endAt" type="datetime-local" /></label></div>
          <div className="formRow"><label>Type<select name="eventType"><option>GENERAL</option><option>MEETING</option><option>PRODUCTION</option><option>DELIVERY</option><option>MAINTENANCE</option><option>CUSTOMER</option></select></label><label>Colour<input name="colour" type="color" defaultValue="#6d5dfc" /></label></div>
          <label>Customer<select name="customerId"><option value="">No customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Assigned to<select name="assignedToId" defaultValue={actor.id}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label className="check"><input name="allDay" type="checkbox" /> All-day event</label>
          <button className="button">Create event</button>
        </form>}
      </div>
    </>
  );
}
