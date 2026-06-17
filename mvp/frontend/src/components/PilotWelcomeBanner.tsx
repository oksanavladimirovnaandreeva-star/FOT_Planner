import { Link } from "react-router-dom";
import { isPilotBundleApplied } from "../data/pilotTestBundle";
import { hasFactData } from "../data/factStore";
import { PILOT_POSITION_TARGET } from "../data/demoPlanSeed";
import { roleCanManageVersions } from "../data/userAccess";
import { useMvpApp } from "../context/MvpAppContext";

/** Подсказка C&B: загрузить пилотный набор перед тестом ролей (GitHub Pages / демо). */
export function PilotWelcomeBanner() {
  const { userRole, positionsTotalCount } = useMvpApp();

  if (!roleCanManageVersions(userRole)) return null;
  if (isPilotBundleApplied() && positionsTotalCount >= PILOT_POSITION_TARGET && hasFactData()) {
    return null;
  }

  return (
    <div className="pilot-welcome-banner" role="status">
      <div>
        <strong>Пилотное тестирование</strong>
        <p className="muted-line">
          Загрузите полный демо-набор: оргструктура, 500+ позиций, утверждённая Версия 1, факт и пресеты
          доступов для ролей. Затем переключайте «Роль (демо)» в сайдбаре.
        </p>
      </div>
      <Link to="/settings" className="primary-btn pilot-welcome-banner__cta">
        Настройки → Данные
      </Link>
    </div>
  );
}
