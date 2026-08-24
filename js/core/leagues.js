/**
 * Оформление лиг: значок и цвета.
 *
 * Пороги и порядок живут в `services/db.js` — это данные. Здесь только
 * то, как лига выглядит, и лежит это отдельно по простой причине: карта
 * значков успела разойтись на две копии (в плашке профиля и в лестнице),
 * с разным набором полей. Третьей копии в приветствии на главном экране
 * лучше не заводить.
 */

const ПО_УМОЛЧАНИЮ = { icon: 'fa-trophy', color: 'text-slate-400', bg: 'bg-slate-500/30' };

/**
 * Значок подобран так, чтобы читался в один взгляд и без подписи:
 * дерево, камень, медаль, награда, кубок, алмаз — от простого к
 * дорогому. Цвет повторяет материал.
 */
export const LEAGUE_STYLE = {
    wooden:  { icon: 'fa-tree',     color: 'text-amber-700',  bg: 'bg-amber-900/30',  ring: 'border-amber-700/50' },
    stone:   { icon: 'fa-mountain', color: 'text-slate-400',  bg: 'bg-slate-500/30',  ring: 'border-slate-400/50' },
    bronze:  { icon: 'fa-medal',    color: 'text-orange-500', bg: 'bg-orange-500/30', ring: 'border-orange-500/50' },
    silver:  { icon: 'fa-award',    color: 'text-gray-300',   bg: 'bg-gray-400/30',   ring: 'border-gray-300/50' },
    gold:    { icon: 'fa-trophy',   color: 'text-yellow-400', bg: 'bg-yellow-500/30', ring: 'border-yellow-400/50' },
    diamond: { icon: 'fa-gem',      color: 'text-cyan-400',   bg: 'bg-cyan-500/30',   ring: 'border-cyan-400/50' }
};

/** Оформление лиги; для незнакомого ключа — нейтральное, а не пустое. */
export const leagueStyle = (key) => LEAGUE_STYLE[key] || ПО_УМОЛЧАНИЮ;
