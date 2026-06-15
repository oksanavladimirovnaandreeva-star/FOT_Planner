import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ExternalLink, X } from "lucide-react";
import {
  availableKaitenTypesForPosition,
  buildKaitenExportFields,
  buildKaitenExportPayload,
  KAITEN_REQUEST_TYPE_LABEL,
  runKaitenExport,
  serializeKaitenPayload,
  type KaitenRequestType,
} from "../data/kaitenExport";
import type { UserRole } from "../data/userAccess";
import type { PlannedEvent, PositionRecord } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  position: PositionRecord;
  planVersionId: string;
  planYear: number;
  userRole: UserRole;
  initialType: KaitenRequestType;
  event?: PlannedEvent;
};

const WIDE_FIELD_KEYS = new Set(["reason", "role"]);

export function KaitenExportModal({
  open,
  onClose,
  position,
  planVersionId,
  planYear,
  userRole,
  initialType,
  event,
}: Props) {
  const availableTypes = useMemo(() => availableKaitenTypesForPosition(position), [position]);
  const [requestType, setRequestType] = useState<KaitenRequestType>(initialType);
  const [exportNote, setExportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequestType(availableTypes.includes(initialType) ? initialType : availableTypes[0] ?? initialType);
    setExportNote(null);
  }, [open, initialType, availableTypes, position.positionId, event?.id]);

  if (!open) return null;

  const fields = buildKaitenExportFields({ position, planYear, requestType, event });
  const payload = buildKaitenExportPayload({ position, planVersionId, planYear, requestType, event });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializeKaitenPayload(payload));
      setExportNote("JSON скопирован в буфер обмена.");
    } catch {
      window.alert("Не удалось скопировать JSON.");
    }
  };

  const handleDownload = () => {
    runKaitenExport({
      position,
      planVersionId,
      planYear,
      requestType,
      userRole,
      event,
    });
    setExportNote("JSON скачан, запись добавлена в журнал экспорта (Настройки).");
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaiten-export-title"
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card--kaiten" onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <header className="kaiten-export-modal__head">
          <div>
            <h2 id="kaiten-export-title" className="drawer-section__title drawer-section__title--kaiten">
              <ExternalLink size={14} aria-hidden />
              Заявка в Kaiten
            </h2>
            <p className="kaiten-export-modal__meta">
              {position.positionId} · {position.role}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        {availableTypes.length > 1 ? (
          <div className="kaiten-type-toggle" role="tablist" aria-label="Тип заявки">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={requestType === type}
                className={`kaiten-type-toggle__btn${requestType === type ? " kaiten-type-toggle__btn--active" : ""}`}
                onClick={() => setRequestType(type)}
              >
                {KAITEN_REQUEST_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        ) : (
          <p className="kaiten-export-modal__type-label">
            Тип: <strong>{KAITEN_REQUEST_TYPE_LABEL[requestType]}</strong>
          </p>
        )}

        <div className="kaiten-export-fields">
          {fields.map((field) => (
            <div
              key={field.key}
              className={`kaiten-export-fields__item${WIDE_FIELD_KEYS.has(field.key) ? " kaiten-export-fields__item--wide" : ""}`}
            >
              <span className="kaiten-export-fields__label">{field.label}</span>
              <span className="kaiten-export-fields__value">{field.value}</span>
            </div>
          ))}
        </div>

        <p className="kaiten-export-modal__hint">
          Демо: API Kaiten не подключён. Скопируйте JSON или скачайте файл для ручной передачи в Service Desk.
        </p>
        {exportNote ? <p className="kaiten-export-modal__note">{exportNote}</p> : null}

        <footer className="kaiten-export-modal__actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className="secondary-btn" onClick={() => void handleCopy()}>
            <Copy size={14} aria-hidden />
            Копировать JSON
          </button>
          <button type="button" className="primary-btn" onClick={handleDownload}>
            <Download size={14} aria-hidden />
            Скачать заявку
          </button>
        </footer>
      </div>
    </div>
  );
}
