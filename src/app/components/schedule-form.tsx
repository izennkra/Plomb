import type { Schedule } from "@/modules/edition/schedule";
import { saveScheduleAction } from "../actions";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Journal frequency: every day, every 3 days, or chosen weekdays — always at 9:00. */
export function ScheduleForm({ schedule, next }: { schedule: Schedule; next: string | null }) {
  return (
    <details className="schedule">
      <summary>
        Fréquence du journal : {label(schedule)} · {next ? `prochaine parution ${next} à 9h00` : "aucun jour choisi"}
      </summary>
      <form action={saveScheduleAction} className="schedule__form">
        <fieldset>
          <legend>Le journal paraît à 9h00 :</legend>
          <label>
            <input type="radio" name="frequency" value="daily" defaultChecked={schedule.frequency === "daily"} /> chaque jour
          </label>
          <label>
            <input type="radio" name="frequency" value="every3days" defaultChecked={schedule.frequency === "every3days"} /> tous
            les 3 jours
          </label>
          <label>
            <input type="radio" name="frequency" value="weekdays" defaultChecked={schedule.frequency === "weekdays"} /> les
            jours choisis :
          </label>
          <span className="schedule__days">
            {WEEKDAYS.map((name, index) => (
              <label key={name}>
                <input type="checkbox" name="weekdays" value={index + 1} defaultChecked={schedule.weekdays.includes(index + 1)} />{" "}
                {name}
              </label>
            ))}
          </span>
        </fieldset>
        <p className="card__meta">Chaque journal couvre tout ce qui est arrivé depuis le précédent.</p>
        <button type="submit">Enregistrer</button>
      </form>
    </details>
  );
}

function label(schedule: Schedule): string {
  if (schedule.frequency === "daily") return "chaque jour";
  if (schedule.frequency === "every3days") return "tous les 3 jours";
  return schedule.weekdays.map((day) => WEEKDAYS[day - 1].toLowerCase()).join(", ");
}
