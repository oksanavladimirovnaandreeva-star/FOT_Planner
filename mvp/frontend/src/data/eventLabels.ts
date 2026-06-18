import type { PlannedEvent } from "../types";

const EVENT_TYPE_LABEL: Record<string, string> = {
  MANUAL_OVERRIDE: "Пересмотр",
  TRANSFER: "Перевод",
  TERMINATION_TO_VACANCY: "Выбытие",
  TERMINATION: "Выбытие",
  CLOSE_POSITION: "Сокращение",
  PLANNED_HIRE: "Найм",
  POSITION_CARRYOVER: "Перенос бюджета",
  INDEXATION: "Индексация",
  CLASSIFICATION_CHANGE: "Смена грейда",
  TARGET_SALARY: "Пересмотр",
  CANCEL_VACANCY: "Сокращение",
};

function eventTypeLabelFromEvent(event: PlannedEvent): string {
  if (event.type === "MANUAL_OVERRIDE" && event.payload.maternityMode === "SHARED_POSITION") {
    return "Декрет";
  }
  return EVENT_TYPE_LABEL[event.type] ?? event.type;
}

export function eventTypeLabel(typeOrEvent: string | PlannedEvent): string {
  if (typeof typeOrEvent !== "string") {
    return eventTypeLabelFromEvent(typeOrEvent);
  }
  return EVENT_TYPE_LABEL[typeOrEvent] ?? typeOrEvent;
}
