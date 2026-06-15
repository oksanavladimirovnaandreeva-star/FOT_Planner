import { useMemo } from "react";
import { DemoRoleSelect } from "../components/DemoRoleSelect";
import { DemoAccessSettingsPanel } from "../components/settings/DemoAccessSettingsPanel";
import { DataSettingsPanel } from "../components/settings/DataSettingsPanel";
import { OrgStructureSettingsPanel } from "../components/settings/OrgStructureSettingsPanel";
import { USER_ROLE_LABELS, useMvpApp } from "../context/MvpAppContext";
import { listExportAuditLog } from "../data/exportAuditLog";
import { resetWorkflowHints } from "../data/workflowHints";
import { formatIsoDateTime } from "../data/formatDisplay";
import type { ExportAuditFormat } from "../data/exportAuditLog";
import {
  formatDemoRoleScope,
  roleScopeDescription,
  roleSettingsAccess,
} from "../data/userAccess";

function exportAuditFormatLabel(format: ExportAuditFormat): string {
  switch (format) {
    case "plan_csv":
      return "План CSV";
    case "fact_csv":
      return "Факт CSV";
    case "kaiten_hire":
      return "Kaiten · найм";
    case "kaiten_otiz":
      return "Kaiten · ОТиЗ";
    default:
      return format;
  }
}

export function SettingsPage() {
  const {
    userRole,
    leadEditFrozen,
    setLeadEditFrozen,
    canToggleLeadFreeze,
    leadEditFrozenForRole,
    positions,
    positionsTotalCount,
    activePlan,
  } = useMvpApp();

  const access = roleSettingsAccess(userRole);
  const scopeLabel = formatDemoRoleScope(userRole);
  const scopeHint = roleScopeDescription(userRole, leadEditFrozen);
  const exportAuditLog = useMemo(() => listExportAuditLog(), []);

  if (access === "stub") {
    return (
      <div className="content-page settings-page">
        <header className="page-header">
          <div>
            <h1>Настройки</h1>
            <p>Импорт данных и администрирование доступны роли C&B.</p>
          </div>
        </header>
        <section className="card settings-section">
          <h2 className="section-title">Роль (демо)</h2>
          <p className="muted-line">Переключение роли для теста прав — доступно всем в MVP.</p>
          <DemoRoleSelect />
        </section>
        <section className="card settings-stub">
          <p>
            Для загрузки факта, управления версиями и демо-набора обратитесь к <strong>C&B</strong>.
          </p>
          {leadEditFrozenForRole ? (
            <p className="settings-stub__warn">Правки для вашей роли закрыты директором.</p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="content-page settings-page">
      <header className="page-header">
        <div>
          <h1>Настройки</h1>
          <p>
            Роль, данные, демо-пилот · год {activePlan.planYear}
          </p>
        </div>
      </header>

      <section className="card settings-section">
        <h2 className="section-title">Роль (демо)</h2>
        <p className="muted-line">Только для тестирования прав доступа в MVP.</p>
        <DemoRoleSelect />
        {scopeLabel ? <p className="settings-scope">{scopeLabel}</p> : null}
        <p className="muted-line">{scopeHint}</p>
        {positions.length !== positionsTotalCount ? (
          <p className="settings-scope settings-scope--warn">
            В срезе {positions.length} из {positionsTotalCount} позиций
          </p>
        ) : null}
      </section>

      {canToggleLeadFreeze ? (
        <section className="card settings-section">
          <h2 className="section-title">Закрытие правок</h2>
          <label className="settings-freeze">
            <input
              type="checkbox"
              checked={leadEditFrozen}
              onChange={(event) => setLeadEditFrozen(event.target.checked)}
            />
            <span>Закрыть правки тимлидов и юнит-лидов</span>
          </label>
          <p className="muted-line">Директор может заблокировать корректировки ниже по иерархии.</p>
        </section>
      ) : null}

      <section className="card settings-section">
        <h2 className="section-title">Оргструктура</h2>
        <OrgStructureSettingsPanel />
      </section>

      <section className="card settings-section">
        <h2 className="section-title">Доступы (демо)</h2>
        <DemoAccessSettingsPanel />
      </section>

      <section className="card settings-section">
        <h2 className="section-title">Данные</h2>
        <DataSettingsPanel />
      </section>

      {access === "full" ? (
        <section className="card settings-section">
          <h2 className="section-title">Журнал экспорта (демо)</h2>
          <p className="muted-line">
            Локальный audit CSV- и Kaiten-экспортов: роль, срез/позиция, версия, число строк. В проде — серверный export_log.
          </p>
          {exportAuditLog.length === 0 ? (
            <p className="muted-line">Экспортов пока не было.</p>
          ) : (
            <div className="table-scroll">
              <table className="export-audit-table">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Роль</th>
                    <th>Формат</th>
                    <th>Строк</th>
                    <th>Версия</th>
                    <th>Срез</th>
                  </tr>
                </thead>
                <tbody>
                  {exportAuditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatIsoDateTime(entry.at)}</td>
                      <td>{USER_ROLE_LABELS[entry.userRole]}</td>
                      <td>{exportAuditFormatLabel(entry.format)}</td>
                      <td>{entry.rowCount}</td>
                      <td>{entry.planVersionId}</td>
                      <td title={`hash: ${entry.scopeHash}`}>{entry.scopeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="card settings-section">
        <h2 className="section-title">Подсказки</h2>
        <p className="muted-line">Сбросить скрытые onboarding-подсказки на Обзоре и Планировании.</p>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            resetWorkflowHints();
            window.alert("Подсказки снова появятся на соответствующих экранах.");
          }}
        >
          Показать подсказки снова
        </button>
      </section>
    </div>
  );
}
