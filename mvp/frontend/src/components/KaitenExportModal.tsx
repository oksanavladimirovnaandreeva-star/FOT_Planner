import { useEffect, useMemo, useState } from "react";
import { Copy, Download, X } from "lucide-react";
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
      <div className="modal-card modal-card--kaiten">
        <div className="kaiten-export-modal__head">
          <div>
            <h2 id="kaiten-export-title" className="section-title">
              Выгрузка в Kaiten
            </h2>
            <p className="muted-line">
              {position.positionId} · {position.role}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

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
          <p className="muted-line">Тип заявки: {KAITEN_REQUEST_TYPE_LABEL[requestType]}</p>
        )}

        <dl className="kaiten-export-fields">
          {fields.map((field) => (
            <div key={field.key} className="kaiten-export-fields__row">
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>

        <p className="muted-line">
          Демо: API Kaiten не подключён. Скачайте JSON для ручной передачи в Service Desk.
        </p>
        {exportNote ? <p className="kaiten-export-modal__note">{exportNote}</p> : null}

        <div className="modal-card__actions kaiten-export-modal__actions">
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
        </div>
      </div>
    </div>
  );
}
