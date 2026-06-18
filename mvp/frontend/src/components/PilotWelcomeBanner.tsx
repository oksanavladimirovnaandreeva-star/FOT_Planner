import { Link } from "react-router-dom";
import { DEFAULT_DEMO_POSITION_COUNT, PILOT_POSITION_TARGET } from "../data/demoPlanSeed";
import { hasFactData } from "../data/factStore";
import { isPilotBundleApplied } from "../data/pilotTestBundle";
import { roleCanManageVersions } from "../data/userAccess";
import { useMvpApp } from "../context/MvpAppContext";

/** Подсказка C&B: тяжёлый пилот — опционально, для стресс-теста ролей. */
export function PilotWelcomeBanner() {
  const { userRole, positionsTotalCount } = useMvpApp();

  if (!roleCanManageVersions(userRole)) return null;
  if (isPilotBundleApplied() && positionsTotalCount >= PILOT_POSITION_TARGET && hasFactData()) {
    return null;
  }

  return (
    <div className="pilot-welcome-banner" role="status">
      <div>
        <strong>Пилотное тестирование (опционально)</strong>
        <p className="muted-line">
          По умолчанию демо-план ~{DEFAULT_DEMO_POSITION_COUNT} позиций. Для стресс-теста срезов и консолидации —
          «Пилот (тяжёлый)» в настройках ({PILOT_POSITION_TARGET}+ поз., может подвиснуть). Затем входите под разными
          пользователями на экране входа.
        </p>
      </div>
      <Link to="/settings" className="primary-btn pilot-welcome-banner__cta">
        Настройки → Данные
      </Link>
    </div>
  );
}
