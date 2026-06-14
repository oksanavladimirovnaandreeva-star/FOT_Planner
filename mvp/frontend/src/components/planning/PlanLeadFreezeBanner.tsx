type Props = {
  /** Текущий пользователь заблокирован freeze (тимлид / юнит-лид). */
  blocked: boolean;
  /** Директор или C&B — freeze активен для подчинённых. */
  managing: boolean;
};

export function PlanLeadFreezeBanner({ blocked, managing }: Props) {
  if (!blocked && !managing) return null;
  return (
    <div
      className={`plan-policy-banner plan-policy-banner--freeze${blocked ? " plan-policy-banner--freeze-blocked" : ""}`}
      role="status"
    >
      {blocked ? (
        <>
          <strong>Правки закрыты директором</strong>
          <p className="muted-line">
            Период корректировок для тимлидов и юнит-лидов заморожен. План и факт доступны только для просмотра;
            события и позиции не сохраняются.
          </p>
        </>
      ) : (
        <>
          <strong>Правки лидов заморожены</strong>
          <p className="muted-line">
            Тимлиды и юнит-лиды не могут менять черновик. Вы (директор / C&B) по-прежнему можете править в своём срезе.
          </p>
        </>
      )}
    </div>
  );
}
