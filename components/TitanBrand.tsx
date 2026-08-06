import styles from "./TitanBrand.module.css";

type TitanBrandProps = {
  compact?: boolean;
};

export default function TitanBrand({ compact = false }: TitanBrandProps) {
  return (
    <div
      className={`${styles.brand} ${compact ? styles.compact : ""}`}
      aria-label="Project TITAN"
    >
      <span className={styles.glow} aria-hidden="true" />

      <img
        className={styles.logo}
        src={
          compact
            ? "/project-titan-mark-ui.png"
            : "/project-titan-logo-ui.png"
        }
        alt="Project TITAN"
        width={compact ? 512 : 1172}
        height={compact ? 512 : 522}
        loading="eager"
        decoding="async"
      />

      {!compact ? (
        <span className={styles.tagline}>Version 4.0</span>
      ) : null}
    </div>
  );
}
