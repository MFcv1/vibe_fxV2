/*
 * Surface de publication (phase F).
 *
 * Elle monte le composeur EXISTANT (`PublicationsManager`), qui utilise le
 * bundle Tailwind statique de l'ancien studio: cette route charge donc les
 * memes feuilles que `/studio` chargeait, ni plus ni moins. VibeOS
 * (`vibeos.css`) n'est pas charge ici, et cette feuille-la n'est pas chargee
 * sous `/creer` : les deux surfaces restent isolees (plan §2.2).
 */
import "../../features/vibefx-layout/vibefx-tailwind.css";
import "../../features/vibefx-layout/vibefx-layout.css";
import "../../features/publications/publications.css";

export default function PublierLayout({ children }) {
  return children;
}
