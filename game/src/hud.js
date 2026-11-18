// VENTARA BAY — HUD: health, cash, wanted stars, objective, speed, clock,
// district, toasts and banners. Every element must read at a glance when
// the screenshot is shrunk to a contact sheet.

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    toast, banner, damageFlash, showEnd, showMenu, hideMenu,
    setHealth, setCash, setWanted, setObjective, setSpeed, setClock,
    setDistrict, setAmmo, setMission, showPause, hidePause,
  };
  let toastTimer = null, bannerTimer = null;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function banner(title, sub) {
    const b = $('banner');
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub || '';
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 3600);
  }
  function damageFlash() {
    const v = $('vignette');
    v.classList.add('hit');
    setTimeout(() => v.classList.remove('hit'), 180);
  }
  function showEnd(title, sub) {
    $('end-title').textContent = title;
    $('end-sub').textContent = sub;
    $('end-screen').classList.add('show');
  }
  function showMenu(hasSave) {
    $('menu').classList.add('show');
    $('btn-continue').style.display = hasSave ? '' : 'none';
  }
  function hideMenu() { $('menu').classList.remove('show'); }
  function showPause() { $('pause').classList.add('show'); }
  function hidePause() { $('pause').classList.remove('show'); }

  function setHealth(h) {
    $('health-fill').style.width = Math.max(0, Math.min(100, h)) + '%';
    $('health-num').textContent = Math.ceil(Math.max(0, h));
  }
  function setCash(c) { $('cash').textContent = '$' + Math.floor(c).toLocaleString('en-US'); }
  function setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '★' : '☆';
    $('stars').textContent = stars;
    $('stars').classList.toggle('hot', n >= 3);
  }
  function setObjective(text, dist) {
    $('objective').textContent = text + (dist != null ? '  •  ' + Math.round(dist) + 'm' : '');
  }
  function setMission(title) { $('mission-name').textContent = title; }
  function setSpeed(kmh) { $('speed').textContent = Math.round(kmh) + ' km/h'; }
  function setClock(t) {
    // t is minutes since midnight (18:00 = 1080 at sunset)
    const mins = Math.floor(t) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    $('clock').textContent = hh + ':' + mm;
  }
  function setDistrict(name) { $('district').textContent = name; }
  function setAmmo(weapon, ammo, reserve) {
    $('weapon').textContent = weapon === 'pistol' ? ('PISTOL  ' + ammo + ' / ' + reserve) : 'FISTS';
  }
  return hud;
}
