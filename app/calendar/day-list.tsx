"use client";

import { MeetingRow, TaskRow } from "./chips";
import { needsGrade, type CalendarClass, type DayItems } from "./items";

type Props = {
  day: DayItems;
  today: string | null;
  classesById: Map<string, CalendarClass>;
  onOpenTask: (id: string) => void;
};

/** One day's meetings, due tasks and study sessions, as full rows. */
export function DayList({ day, today, classesById, onOpenTask }: Props) {
  const classOf = (id: string | null) => (id ? classesById.get(id) : undefined);

  return (
    <ul className="flex flex-col">
      {day.meetings.map((m) => (
        <li key={`${m.meetingId}-${m.date}`}>
          <MeetingRow meeting={m} schoolClass={classOf(m.classId)} />
        </li>
      ))}
      {day.due.map((t) => (
        <li key={`due-${t.id}`}>
          <TaskRow
            task={t}
            kind="due"
            schoolClass={classOf(t.class_id)}
            needsGrade={needsGrade(t, today)}
            onOpen={() => onOpenTask(t.id)}
          />
        </li>
      ))}
      {day.study.map((t) => (
        <li key={`study-${t.id}`}>
          <TaskRow
            task={t}
            kind="study"
            schoolClass={classOf(t.class_id)}
            needsGrade={false}
            onOpen={() => onOpenTask(t.id)}
          />
        </li>
      ))}
    </ul>
  );
}
