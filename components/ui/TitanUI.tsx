import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";
import styles from "./TitanUI.module.css";

function classes(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

export function TitanPage({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classes(styles.page, className)} {...props}>
      {children}
    </div>
  );
}

export function TitanPageHeader({
  eyebrow = "Project TITAN · Version 4",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className={styles.headerActions}>{actions}</div>
      ) : null}
    </header>
  );
}

export function TitanGrid({
  children,
  variant = "metrics",
  className,
}: {
  children: ReactNode;
  variant?: "metrics" | "two" | "three";
  className?: string;
}) {
  return (
    <div
      className={classes(
        styles.grid,
        variant === "metrics" && styles.metrics,
        variant === "two" && styles.twoColumns,
        variant === "three" && styles.threeColumns,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TitanCard({
  title,
  description,
  actions,
  children,
  interactive = false,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <section
      className={classes(
        styles.card,
        interactive && styles.cardInteractive,
        className,
      )}
    >
      {title || description || actions ? (
        <div className={styles.cardHeader}>
          <div>
            {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
            {description ? (
              <p className={styles.cardDescription}>{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className={styles.cardActions}>{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export function TitanMetric({
  label,
  value,
  icon,
  footer,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  accent?: string;
}) {
  const style = accent
    ? ({ "--metric-accent": accent } as CSSProperties)
    : undefined;

  return (
    <article className={classes(styles.card, styles.metric)} style={style}>
      <div className={styles.metricTop}>
        <span className={styles.metricLabel}>{label}</span>
        {icon ? <span className={styles.metricIcon}>{icon}</span> : null}
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      {footer ? <div className={styles.metricFooter}>{footer}</div> : null}
    </article>
  );
}

export function TitanBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span
      className={classes(
        styles.badge,
        tone === "success" && styles.badgeSuccess,
        tone === "warning" && styles.badgeWarning,
        tone === "danger" && styles.badgeDanger,
        tone === "info" && styles.badgeInfo,
      )}
    >
      {children}
    </span>
  );
}

type TitanButtonProps = {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "normal" | "small";
  full?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function TitanButton({
  children,
  href,
  type = "button",
  variant = "primary",
  size = "normal",
  full = false,
  className,
  disabled,
  onClick,
}: TitanButtonProps) {
  const classNames = classes(
    styles.button,
    variant === "primary" && styles.buttonPrimary,
    variant === "secondary" && styles.buttonSecondary,
    variant === "danger" && styles.buttonDanger,
    variant === "ghost" && styles.buttonGhost,
    size === "small" && styles.buttonSmall,
    full && styles.buttonFull,
    className,
  );

  if (href) {
    return (
      <Link className={classNames} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classNames}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TitanTableFrame({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.tableFrame}>{children}</div>;
}

export function TitanEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <div>
        {icon ? <div className={styles.emptyIcon}>{icon}</div> : null}
        <h3 className={styles.emptyTitle}>{title}</h3>
        <p className={styles.emptyDescription}>{description}</p>
        {action ? <div className={styles.headerActions}>{action}</div> : null}
      </div>
    </div>
  );
}

export function TitanList({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={styles.list}>{children}</div>;
}

export function TitanListItem({
  title,
  meta,
  aside,
}: {
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.listItem}>
      <div className={styles.listItemMain}>
        <span className={styles.listItemTitle}>{title}</span>
        {meta ? <span className={styles.listItemMeta}>{meta}</span> : null}
      </div>
      {aside ? <div className={styles.listItemAside}>{aside}</div> : null}
    </div>
  );
}
