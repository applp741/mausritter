const STORAGE_KEY = "mausritter-card-app-v1";
const DATABASE_CSV_URL = "https://docs.google.com/spreadsheets/d/1YSE23y_C5d89gnkpGNfNltN0UQ1sMazzDA0W7FweBRI/export?format=csv&gid=0";
const BASE_MONEY_LIMIT = 250;
const diceTypes = [6, 8, 10, 20];
const equipSlots = [
  { id: "mainPaw", label: "主爪", row: 0, col: 0, region: "paw" },
  { id: "bodyA", label: "身體", row: 0, col: 1, region: "body" },
  { id: "offPaw", label: "副爪", row: 1, col: 0, region: "paw" },
  { id: "bodyB", label: "身體", row: 1, col: 1, region: "body" },
];
const packSlots = Array.from({ length: 6 }, (_, index) => ({ id: `pack${index + 1}`, label: `${index + 1}`, row: Math.floor(index / 3), col: index % 3, region: "pack" }));

const itemPresets = [
  { name: "臨時", kind: "臨時", icon: "branch", usageMax: 3, damage: "d6", equipRule: "paw" },
  { name: "針", kind: "輕型", icon: "needle", usageMax: 3, damage: "d6", equipRule: "paw" },
  { name: "匕首", kind: "中型", icon: "dagger", usageMax: 3, damage: "d6/d8", equipRule: "paw" },
  { name: "斧", kind: "中型", icon: "axe", usageMax: 3, damage: "d6/d8", equipRule: "paw" },
  { name: "劍", kind: "中型", icon: "sword", usageMax: 3, damage: "d6/d8", equipRule: "paw" },
  { name: "錘", kind: "中型", icon: "hammer", usageMax: 3, damage: "d6/d8", equipRule: "paw" },
  { name: "戰鎚", kind: "重型", icon: "maul", usageMax: 3, damage: "d10", slots: 2, slotShape: "1x2", equipRule: "twoPaws" },
  { name: "長矛", kind: "重型", icon: "spear", usageMax: 3, damage: "d10", slots: 2, slotShape: "1x2", equipRule: "twoPaws" },
  { name: "長鉤", kind: "重型", icon: "hook", usageMax: 3, damage: "d10", slots: 2, slotShape: "1x2", equipRule: "twoPaws" },
  { name: "石頭", kind: "彈藥", icon: "stone", usageMax: 3, equipRule: "paw" },
  { name: "箭矢", kind: "彈藥", icon: "arrows", usageMax: 3, equipRule: "paw" },
  { name: "投石索", kind: "輕型遠程", icon: "sling", usageMax: 3, damage: "d6", equipRule: "paw" },
  { name: "弓", kind: "重型遠程", icon: "bow", usageMax: 3, damage: "d8", slots: 2, slotShape: "1x2", equipRule: "twoPaws" },
  { name: "輕甲", kind: "輕甲", icon: "lightArmor", usageMax: 3, armor: "1護甲", slots: 2, slotShape: "2x1", equipRule: "bodyPaw" },
  { name: "重甲", kind: "重甲", icon: "heavyArmor", usageMax: 3, armor: "1護甲", slots: 2, slotShape: "1x2", equipRule: "body" },
  { name: "火炬", kind: "光源", icon: "torch", usageMax: 3 },
  { name: "提燈", kind: "光源", icon: "lantern", usageMax: 3 },
  { name: "電提燈", kind: "光源", icon: "electricLantern", usageMax: 6 },
  { name: "錢袋", kind: "金錢", icon: "purse", usageMax: 0, note: "/ 250" },
  { name: "口糧", kind: "消耗", icon: "ration", usageMax: 3 },
  { name: "法術石板", kind: "法術", icon: "spell", usageMax: 3 },
];

const conditionPresets = [
  { name: "疲憊", detail: "移除：長休之後" },
  { name: "恐懼", detail: "移除：短休之後" },
  { name: "飢餓", detail: "移除：用餐之後" },
  { name: "受傷", detail: "力量/敏捷檢定時擁有劣勢；移除：完全休息之後" },
  { name: "枯竭", detail: "意志檢定時擁有劣勢；移除：完全休息之後" },
];

let state = loadState();
let longPressTimer = null;
let activeDrag = null;
let touchDrag = null;
let pendingDrag = null;
let tabHoverTimer = null;
let rollTwoDice = false;

const app = document.querySelector("#app");

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeItem(data) {
  return {
    id: uid(),
    type: "item",
    name: data.name || "新物品",
    kind: data.kind || "物品",
    icon: data.icon || "□",
    usageMax: Number(data.usageMax || 3),
    usage: Number(data.usage || 0),
    damage: data.damage || "",
    armor: data.armor || "",
    note: data.note || "",
    category: data.category || "",
    slots: Number(data.slots || 1),
    slotShape: data.slotShape || (Number(data.slots || 1) === 2 ? "1x2" : "1x1"),
    equipRule: data.equipRule || "any",
    slotGroup: data.slotGroup || "any",
  };
}

function makeCondition(data) {
  const detailParts = splitConditionDetail(data.detail || "");
  return {
    id: uid(),
    type: "condition",
    name: data.name || "自訂狀態",
    effect: data.effect || detailParts.effect,
    remove: data.remove || detailParts.remove || "移除：",
    detail: data.detail || [data.effect, data.remove].filter(Boolean).join("；") || "移除：",
    usageMax: 0,
    usage: 0,
  };
}

function makeCharacter(name = "柳葉") {
  const character = {
    id: uid(),
    name,
    origin: "流浪者",
    portrait: "",
    stats: {
      str: { label: "力量", max: 8, current: 8 },
      dex: { label: "敏捷", max: 11, current: 11 },
      wil: { label: "意志", max: 9, current: 9 },
    },
    hp: { max: 4, current: 4 },
    money: 18,
    slots: {
      mainPaw: null,
      offPaw: null,
      bodyA: null,
      bodyB: null,
      pack1: null,
      pack2: null,
      pack3: null,
      pack4: null,
      pack5: null,
      pack6: null,
    },
    level: 1,
    xp: 0,
    grit: [],
    notes: "",
  };
  placeCard(character, "mainPaw", makeItem(itemPresets[2]));
  placeCard(character, "offPaw", makeItem(itemPresets[13]));
  placeCard(character, "pack1", makeItem(itemPresets[0]));
  placeCard(character, "pack2", makeItem(itemPresets[1]));
  placeCard(character, "pack3", makeItem(itemPresets[1]));
  return character;
}

function defaultState() {
  const character = makeCharacter();
  return {
    characters: [character],
    activeCharacterId: character.id,
    activePage: "equipment",
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.characters?.length) return defaultState();
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function normalizeState(targetState) {
  targetState.characters.forEach(normalizeCharacter);
  return targetState;
}

function normalizeCharacter(character) {
  const nextSlots = {};
  [...equipSlots, ...packSlots].forEach((slot) => { nextSlots[slot.id] = null; });
  const cards = [...equipSlots, ...packSlots]
    .map((slot) => ({ slotId: slot.id, card: character.slots?.[slot.id] }))
    .filter(({ card }) => card && card.type !== "linked")
    .map(({ slotId, card }) => ({ slotId, card: normalizeCard(card) }));

  character.slots = nextSlots;
  cards.forEach(({ slotId, card }) => {
    const preferred = canPlaceCard(character, slotId, card) ? slotId : findFirstFittingSlot(character, card, slotId);
    if (preferred) placeCard(character, preferred, card);
  });
  character.money = clamp(Number(character.money || 0), 0, moneyLimit(character));
}

function normalizeCard(card) {
  if (card.type === "condition") return normalizeCondition(card);
  if (card.type !== "item") return card;
  const preset = itemPresets.find((item) => item.name === card.name);
  if (!preset) {
    return {
      ...card,
      slots: Number(card.slots || 1),
      slotShape: card.slotShape || (Number(card.slots || 1) === 2 ? "1x2" : "1x1"),
      equipRule: card.equipRule || "any",
    };
  }
  return {
    ...card,
    kind: preset.kind,
    icon: preset.icon,
    usageMax: Number(preset.usageMax || card.usageMax || 0),
    damage: preset.damage || "",
    armor: preset.armor || "",
    note: preset.note || card.note || "",
    category: preset.category || card.category || "",
    slots: Number(preset.slots || 1),
    slotShape: preset.slotShape || (Number(preset.slots || 1) === 2 ? "1x2" : "1x1"),
    equipRule: preset.equipRule || "any",
  };
}

function normalizeCondition(card) {
  const detailParts = splitConditionDetail(card.detail || "");
  const effectParts = splitConditionDetail(card.effect || "");
  return {
    ...card,
    effect: effectParts.effect || card.effect || detailParts.effect,
    remove: card.remove || effectParts.remove || detailParts.remove || card.detail || "移除：",
    detail: card.detail || [card.effect, card.remove].filter(Boolean).join("；") || "移除：",
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeCharacter() {
  return state.characters.find((character) => character.id === state.activeCharacterId) || state.characters[0];
}

function moneyLimit(character) {
  const purseCount = Object.values(character.slots || {}).filter((card) => card?.type === "item" && card.name === "錢袋").length;
  return BASE_MONEY_LIMIT + purseCount * 250;
}

function updateCharacter(mutator) {
  const character = activeCharacter();
  mutator(character);
  saveState();
  render();
}

function render() {
  const character = activeCharacter();
  normalizeCharacter(character);
  saveState();
  const maxMoney = moneyLimit(character);
  app.innerHTML = `
    <section class="layout-grid">
      <div class="top-layout">
          <div class="name-block" data-long="identity">
            <div class="name-text">${escapeHtml(character.name)}</div>
            <div class="origin-text">${escapeHtml(character.origin)}</div>
            <button class="settings-button" data-action="settings" aria-label="設定">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" stroke="currentColor" stroke-width="2"/>
                <path d="M19 13.3v-2.6l-2.1-.6a7.4 7.4 0 0 0-.8-1.8l1-1.9-1.9-1.9-1.9 1a7.4 7.4 0 0 0-1.8-.8L10.7 2H8.1l-.6 2.1c-.6.2-1.2.5-1.8.8l-1.9-1-1.9 1.9 1 1.9c-.3.6-.6 1.2-.8 1.8L0 10.1v2.6l2.1.6c.2.6.5 1.2.8 1.8l-1 1.9 1.9 1.9 1.9-1c.6.3 1.2.6 1.8.8l.6 2.1h2.6l.6-2.1c.6-.2 1.2-.5 1.8-.8l1.9 1 1.9-1.9-1-1.9c.3-.6.6-1.2.8-1.8l2.1-.6Z" transform="translate(2 1)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
      </div>
      <div class="hero-layout">
        <div class="portrait-card">
          <div class="portrait">
            <label class="portrait-label">
              ${character.portrait ? `<img src="${character.portrait}" alt="角色形象">` : "上傳<br>角色形象"}
              <input type="file" accept="image/*" data-action="portrait">
            </label>
          </div>
        </div>
        <div class="stats-stack">
          <div class="level-panel compact-level">
            <div class="level-title" data-long="level"><span>等級</span><span class="level-number">${character.level}</span></div>
          </div>
          <div class="hp-card" data-action="hp-sheet">
            <span class="hp-label">生命值</span>
            <span class="hp-summary ${character.hp.current < character.hp.max ? "is-wounded" : ""}">${character.hp.current}</span><span class="hp-divider">/</span><span>${character.hp.max}</span>
          </div>
          <div class="stat-panel">
            ${Object.entries(character.stats)
              .map(([key, stat]) => `
                <div class="stat-row">
                  <div class="stat-name">${stat.label}</div>
                  <button class="stat-summary" data-long="statMax" data-stat="${key}">
                    <span class="${stat.current < stat.max ? "is-wounded" : ""}">${stat.current}</span><span class="stat-divider">/</span><span>${stat.max}</span>
                  </button>
                </div>
              `)
              .join("")}
          </div>
          <div class="money-panel stat-money">
            <div class="money-label">金錢</div>
            <button class="money-summary" data-action="money-sheet">
              <span>${Number(character.money || 0)}</span><span class="money-cap">/${maxMoney}</span>
            </button>
          </div>
        </div>
      </div>
      <section class="inventory-panel" data-swipe>
        <div class="tabs">
          <button class="tab ${state.activePage === "equipment" ? "active" : ""}" data-page="equipment">裝備</button>
          <button class="tab ${state.activePage === "pack" ? "active" : ""}" data-page="pack">背包</button>
        </div>
        ${renderSlots(character)}
      </section>
      <div class="utility-row">
        <div class="grit-panel">
          <div class="grit-title"><span>堅韌</span>${character.level < 2 ? `<span class="grit-locked">2等級開啟</span>` : ""}</div>
          <div class="grit-dots">
            ${renderGrit(character)}
          </div>
        </div>
        <button class="notes-button" data-action="notes">筆記</button>
      </div>
    </section>
    ${renderBottomNav()}
  `;
  bindEvents();
}

function renderSlots(character) {
  const slots = state.activePage === "equipment" ? equipSlots : packSlots;
  const gridClass = state.activePage === "equipment" ? "equipment-grid" : "pack-grid";
  return `<div class="slot-grid ${gridClass}">
    ${slots
      .map((slot) => {
        const card = character.slots[slot.id];
        if (card?.type === "linked") return "";
        const spanClass = getSpanClass(card, "slot");
        return `<div class="slot ${spanClass}" data-slot="${slot.id}" data-long-empty="${card ? "" : slot.id}">
          <div class="slot-label">${slot.label}</div>
          ${card ? renderCard(card, slot.id) : ""}
        </div>`;
      })
      .join("")}
  </div>`;
}

function renderCard(card, slotId) {
  const spanClass = getSpanClass(card, "card");
  const conditionEffect = card.type === "condition" ? getConditionEffect(card) : "";
  return `
    <article class="item-card ${card.type === "condition" ? "condition" : ""} ${spanClass}" data-card="${card.id}" data-slot-card="${slotId}" data-long-card="${slotId}">
      <div class="item-title">${escapeHtml(card.name)}</div>
      ${card.usageMax ? `<div class="usage-count">${Math.max(0, Number(card.usageMax || 0) - Number(card.usage || 0))}</div>` : ""}
      ${card.damage ? `<div class="damage-badge">${escapeHtml(card.damage)}</div>` : ""}
      ${card.armor ? `<div class="armor-badge">${escapeHtml(card.armor)}</div>` : ""}
      <div class="item-art">${card.type === "condition" ? `<span class="condition-effect">${escapeHtml(conditionEffect)}</span>` : renderCardArt(card)}</div>
      <div class="item-meta">
        <span></span>
        <span>${escapeHtml(card.type === "condition" || card.category === "法術" ? "" : (card.note || card.detail || ""))}</span>
      </div>
    </article>
  `;
}

function getSpanClass(card, target) {
  if (!card || Number(card.slots || 1) !== 2) return "";
  const shape = getSlotShape(card);
  if (target === "card") return shape === "2x1" ? "span-h" : "span-v";
  return shape === "2x1" ? "occupied-span-h" : "occupied-span-v";
}

function renderCardArt(card) {
  if (card.type === "condition") return `<span class="condition-mark">!</span>`;
  const key = card.icon || "blank";
  const art = {
    branch: `<svg viewBox="0 0 80 80"><path d="M22 62 53 18M42 34l20-8M36 44l-15-9" /><path d="M55 23l10 8-8 8-10-8z" /></svg>`,
    needle: `<svg viewBox="0 0 80 80"><path d="M18 60 61 20" /><circle cx="56" cy="24" r="5" /></svg>`,
    dagger: `<svg viewBox="0 0 80 80"><path d="M20 62 54 28" /><path d="M48 20l12 12M42 36l9 9M36 30l14 14" /></svg>`,
    axe: `<svg viewBox="0 0 80 80"><path d="M25 66 54 20" /><path d="M49 18c15 5 16 18 1 25-3-9-8-15-18-17 6-4 11-7 17-8Z" /></svg>`,
    sword: `<svg viewBox="0 0 80 80"><path d="M20 64 55 18M48 17l9 9M38 43l-8-8M31 50l-8-8" /></svg>`,
    hammer: `<svg viewBox="0 0 80 80"><path d="M35 68 44 31" /><path d="M25 25h34l5 11H30z" /></svg>`,
    maul: `<svg viewBox="0 0 80 80"><path d="M36 68 42 27" /><path d="M18 24h44l5 16H22z" /></svg>`,
    spear: `<svg viewBox="0 0 80 80"><path d="M28 67 54 18" /><path d="M55 13l8 15-15-4z" /></svg>`,
    hook: `<svg viewBox="0 0 80 80"><path d="M35 68 47 30" /><path d="M47 31c20-16 25 18 4 20" /></svg>`,
    stone: `<svg viewBox="0 0 80 80"><path d="M23 50 38 23l22 9 4 22-20 10z" /></svg>`,
    arrows: `<svg viewBox="0 0 80 80"><path d="M24 65 54 18M34 66 62 24M52 18l12 3-6 10M60 24l10 5-8 8" /></svg>`,
    sling: `<svg viewBox="0 0 80 80"><path d="M22 63c14-2 21-15 24-30M58 64c-13-3-17-18-13-31M40 28c8 0 13 4 13 9-8 5-18 5-26 0 0-5 5-9 13-9Z" /></svg>`,
    bow: `<svg viewBox="0 0 80 80"><path d="M28 68c24-14 24-42 0-56M29 12c7 18 7 38 0 56M52 12v56" /></svg>`,
    lightArmor: `<svg viewBox="0 0 80 80"><path d="M20 23c11 0 13-5 20-10 7 5 9 10 20 10-1 18-5 31-20 43-15-12-19-25-20-43Z" /><circle cx="40" cy="40" r="10" /></svg>`,
    heavyArmor: `<svg viewBox="0 0 80 80"><path d="M20 18h40l6 48H14z" /><path d="M24 29h32M22 42h36M20 55h40" /></svg>`,
    torch: `<svg viewBox="0 0 80 80"><path d="M38 34 25 68M46 36 33 70" /><path d="M42 9c12 13 2 21 1 29-15-8-6-21-1-29Z" /></svg>`,
    lantern: `<svg viewBox="0 0 80 80"><path d="M26 30h28v34H26zM32 30V18h16v12M30 64h20" /><path d="M35 41c8 5 8 10 0 15" /></svg>`,
    electricLantern: `<svg viewBox="0 0 80 80"><path d="M28 22h24l5 42H23zM34 15h12v7" /><path d="M18 35l-8-6M62 35l8-6M20 50l-10 3M60 50l10 3" /></svg>`,
    purse: `<svg viewBox="0 0 80 80"><path d="M27 25c8 7 18 7 26 0l7 34c-12 8-28 8-40 0z" /><path d="M31 25c0-9 18-9 18 0" /></svg>`,
    ration: `<svg viewBox="0 0 80 80"><path d="M19 49c11-18 23-24 42-18-1 20-16 31-42 18Z" /><path d="M31 50c3-10 9-16 19-19" /></svg>`,
    spell: `<svg viewBox="0 0 80 80"><path d="M21 19h38l8 41-37 8z" /><path d="M32 32l16 8-15 11M49 28l-6 27" /></svg>`,
  };
  return art[key] || `<span>${escapeHtml(key)}</span>`;
}

function renderGrit(character) {
  const count = Math.max(0, character.level - 1);
  if (!count) return "";
  return Array.from({ length: count }, (_, index) => `<button class="grit-dot ${character.grit[index] ? "filled" : ""}" data-grit="${index}" aria-label="堅韌 ${index + 1}"></button>`).join("");
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav">
      ${diceTypes.map((die) => `<button class="dice-button" data-die-button="${die}" aria-label="擲 d${die}">d${die}</button>`).join("")}
      <label class="advantage-toggle">
        <input type="checkbox" data-roll-two ${rollTwoDice ? "checked" : ""}>
        <span>優/劣</span>
      </label>
    </nav>
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePage = button.dataset.page;
      saveState();
      render();
    });
  });

  app.querySelector("[data-action='settings']").addEventListener("click", openSettings);

  app.querySelector("[data-action='portrait']").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateCharacter((character) => { character.portrait = reader.result; });
    reader.readAsDataURL(file);
  });

  app.querySelector("[data-action='hp-sheet']").addEventListener("click", openHpSheet);

  app.querySelector("[data-action='notes']").addEventListener("click", openNotesModal);

  app.querySelector("[data-action='money-sheet']").addEventListener("click", openMoneySheet);

  bindLongPress(app.querySelector("[data-long='identity']"), () => openIdentityModal());
  app.querySelectorAll("[data-long='statMax']").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.stat;
      openStatSheet(key);
    });
  });
  app.querySelector("[data-long='level']").addEventListener("click", openXpSheet);

  app.querySelectorAll("[data-long-card]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (card.dataset.suppressTap === "true") {
        event.stopPropagation();
        return;
      }
      event.stopPropagation();
      openCardMenu(card.dataset.longCard);
    });
    bindTouchDrag(card);
  });

  app.querySelectorAll(".slot").forEach((slot) => {
    const slotId = slot.dataset.slot;
    if (!activeCharacter().slots[slotId]) {
      slot.addEventListener("click", () => openEmptySlotMenu(slotId));
    }
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drag-over");
      moveCard(activeDrag, slotId);
    });
  });

  app.querySelectorAll("[data-dot]").forEach((dot) => {
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      const slotId = dot.dataset.dot;
      const index = Number(dot.dataset.dotIndex);
      updateCharacter((character) => {
        const card = character.slots[slotId];
        card.usage = index < card.usage ? index : index + 1;
      });
    });
  });

  app.querySelectorAll("[data-grit]").forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.dataset.grit);
      updateCharacter((character) => { character.grit[index] = !character.grit[index]; });
    });
  });

  bindDice();
  bindSwipe();
}

function bindTouchDrag(cardElement) {
  let startX = 0;
  let startY = 0;
  let armed = false;
  const slotId = cardElement.dataset.slotCard;

  cardElement.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    armed = true;
    armDocumentDrag(cardElement, slotId, startX, startY);
  });

  cardElement.addEventListener("pointermove", (event) => {
    if (!armed) return;
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (!touchDrag && distance > 9) {
      window.clearTimeout(longPressTimer);
      startTouchDrag(cardElement, slotId, event.clientX, event.clientY);
    }
    if (touchDrag) {
      event.preventDefault();
      moveTouchDrag(event.clientX, event.clientY);
    }
  });

  cardElement.addEventListener("pointerup", (event) => {
    armed = false;
    if (touchDrag) finishTouchDrag(event.clientX, event.clientY);
  });

  cardElement.addEventListener("pointercancel", () => {
    armed = false;
    cancelTouchDrag();
  });

  cardElement.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    armed = true;
    armDocumentDrag(cardElement, slotId, startX, startY);
  });

  cardElement.addEventListener("mousemove", (event) => {
    if (!armed || event.buttons !== 1) return;
    const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (!touchDrag && distance > 9) {
      window.clearTimeout(longPressTimer);
      startTouchDrag(cardElement, slotId, event.clientX, event.clientY);
    }
    if (touchDrag) {
      event.preventDefault();
      moveTouchDrag(event.clientX, event.clientY);
    }
  });

  cardElement.addEventListener("mouseup", (event) => {
    armed = false;
    if (touchDrag) finishTouchDrag(event.clientX, event.clientY);
  });
}

function armDocumentDrag(cardElement, slotId, x, y) {
  pendingDrag = { cardElement, slotId, x, y };
  document.addEventListener("pointermove", handlePendingDragMove, { passive: false });
  document.addEventListener("pointerup", clearPendingDrag);
  document.addEventListener("mousemove", handlePendingDragMove, { passive: false });
  document.addEventListener("mouseup", clearPendingDrag);
}

function handlePendingDragMove(event) {
  if (!pendingDrag || touchDrag) return;
  const distance = Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y);
  if (distance <= 9) return;
  event.preventDefault();
  window.clearTimeout(longPressTimer);
  startTouchDrag(pendingDrag.cardElement, pendingDrag.slotId, event.clientX, event.clientY);
  clearPendingDrag();
}

function clearPendingDrag() {
  pendingDrag = null;
  document.removeEventListener("pointermove", handlePendingDragMove);
  document.removeEventListener("pointerup", clearPendingDrag);
  document.removeEventListener("mousemove", handlePendingDragMove);
  document.removeEventListener("mouseup", clearPendingDrag);
}

function startTouchDrag(cardElement, fromSlot, x, y) {
  const rect = cardElement.getBoundingClientRect();
  const ghost = cardElement.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);
  touchDrag = {
    fromSlot,
    sourceElement: cardElement,
    ghost,
    offsetX: x - rect.left,
    offsetY: y - rect.top,
    lastTab: null,
  };
  cardElement.classList.add("drag-source");
  document.addEventListener("pointermove", handleDocumentTouchDrag, { passive: false });
  document.addEventListener("pointerup", handleDocumentTouchDrop);
  document.addEventListener("pointercancel", cancelTouchDrag);
  document.addEventListener("mousemove", handleDocumentTouchDrag, { passive: false });
  document.addEventListener("mouseup", handleDocumentTouchDrop);
  moveTouchDrag(x, y);
}

function handleDocumentTouchDrag(event) {
  if (!touchDrag) return;
  event.preventDefault();
  moveTouchDrag(event.clientX, event.clientY);
}

function handleDocumentTouchDrop(event) {
  if (!touchDrag) return;
  finishTouchDrag(event.clientX, event.clientY);
}

function moveTouchDrag(x, y) {
  if (!touchDrag) return;
  touchDrag.ghost.style.left = `${x - touchDrag.offsetX}px`;
  touchDrag.ghost.style.top = `${y - touchDrag.offsetY}px`;
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest?.(".slot");
  document.querySelectorAll(".slot.drag-over").forEach((node) => node.classList.remove("drag-over"));
  if (slot) slot.classList.add("drag-over");

  const tab = element?.closest?.("[data-page]");
  if (tab && tab.dataset.page !== state.activePage && touchDrag.lastTab !== tab.dataset.page) {
    scheduleDragPageSwitch(tab.dataset.page);
    return;
  }

  const edgePage = getDragEdgePage(x);
  if (edgePage && edgePage !== state.activePage && touchDrag.lastTab !== edgePage) {
    scheduleDragPageSwitch(edgePage);
    return;
  }
  if (!tab && !edgePage) {
    window.clearTimeout(tabHoverTimer);
    touchDrag.lastTab = null;
  }
}

function getDragEdgePage(x) {
  const shell = document.querySelector(".app-shell")?.getBoundingClientRect();
  if (!shell) return null;
  const edgeSize = Math.min(92, shell.width * 0.24);
  if (state.activePage === "equipment" && x > shell.right - edgeSize) return "pack";
  if (state.activePage === "pack" && x < shell.left + edgeSize) return "equipment";
  return null;
}

function scheduleDragPageSwitch(page) {
  window.clearTimeout(tabHoverTimer);
  touchDrag.lastTab = page;
  tabHoverTimer = window.setTimeout(() => {
    state.activePage = page;
    saveState();
    render();
    if (touchDrag?.ghost) document.body.appendChild(touchDrag.ghost);
  }, 120);
}

function finishTouchDrag(x, y) {
  if (!touchDrag) return;
  window.clearTimeout(tabHoverTimer);
  const fromSlot = touchDrag.fromSlot;
  const element = document.elementFromPoint(x, y);
  const targetSlot = element?.closest?.(".slot")?.dataset.slot;
  cleanupTouchDrag();
  if (targetSlot) moveCard(fromSlot, targetSlot);
}

function cancelTouchDrag() {
  window.clearTimeout(tabHoverTimer);
  cleanupTouchDrag();
}

function cleanupTouchDrag() {
  if (touchDrag?.sourceElement) {
    const sourceElement = touchDrag.sourceElement;
    sourceElement.dataset.suppressTap = "true";
    window.setTimeout(() => {
      delete sourceElement.dataset.suppressTap;
    }, 300);
  }
  touchDrag?.ghost?.remove();
  touchDrag = null;
  clearPendingDrag();
  document.removeEventListener("pointermove", handleDocumentTouchDrag);
  document.removeEventListener("pointerup", handleDocumentTouchDrop);
  document.removeEventListener("pointercancel", cancelTouchDrag);
  document.removeEventListener("mousemove", handleDocumentTouchDrag);
  document.removeEventListener("mouseup", handleDocumentTouchDrop);
  document.querySelectorAll(".drag-source, .drag-over").forEach((node) => node.classList.remove("drag-source", "drag-over"));
}

function updateCharacterNoRender(mutator) {
  mutator(activeCharacter());
  saveState();
}

function bindLongPress(element, callback) {
  if (!element) return;
  const start = (event) => {
    longPressTimer = window.setTimeout(() => {
      event.preventDefault();
      callback();
    }, 560);
  };
  const cancel = () => window.clearTimeout(longPressTimer);
  element.addEventListener("pointerdown", start);
  element.addEventListener("pointerup", cancel);
  element.addEventListener("pointerleave", cancel);
  element.addEventListener("pointercancel", cancel);
}

function bindSwipe() {
  const target = app.querySelector("[data-swipe]");
  let startX = 0;
  let canSwipe = false;
  target.addEventListener("pointerdown", (event) => {
    canSwipe = !event.target.closest(".item-card");
    startX = event.clientX;
  });
  target.addEventListener("pointerup", (event) => {
    if (!canSwipe) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) < 45) return;
    state.activePage = delta < 0 ? "pack" : "equipment";
    saveState();
    render();
  });
}

function bindDice() {
  app.querySelectorAll("[data-die-button]").forEach((diceButton) => {
    diceButton.addEventListener("click", () => rollDice(Number(diceButton.dataset.dieButton)));
  });
  app.querySelector("[data-roll-two]")?.addEventListener("change", (event) => {
    rollTwoDice = event.target.checked;
  });
}

function rollDice(sides) {
  const results = Array.from({ length: rollTwoDice ? 2 : 1 }, () => Math.floor(Math.random() * sides) + 1);
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="dice-result">
      <div>
        <div class="dice-faces ${rollTwoDice ? "two" : ""}" data-dice-faces>
          ${results.map(() => `<div class="dice-face rolling" data-dice-face>?</div>`).join("")}
        </div>
        <p class="dice-caption">d${sides}</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const faces = Array.from(overlay.querySelectorAll("[data-dice-face]"));
  let ticks = 0;
  const interval = window.setInterval(() => {
    ticks += 1;
    faces.forEach((face, index) => {
      face.textContent = String(Math.floor(Math.random() * sides) + 1);
      face.style.transform = `rotate(${(ticks % 2 ? 18 : -18) * (index ? -1 : 1)}deg) scale(${ticks % 3 === 0 ? 1.08 : 0.98})`;
    });
  }, 48);
  window.setTimeout(() => {
    window.clearInterval(interval);
    faces.forEach((face, index) => {
      face.textContent = String(results[index]);
      face.classList.remove("rolling");
      face.style.transform = "";
      face.classList.add("settled");
    });
    overlay.addEventListener("click", () => overlay.remove());
  }, 460);
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 20);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 180);
  }, 1900);
}

function moveCard(fromSlot, toSlot) {
  if (!fromSlot || fromSlot === toSlot) return;
  updateCharacter((character) => {
    const result = moveCardWithSwap(character, fromSlot, toSlot);
    if (!result.ok && result.message) showToast(result.message);
  });
}

function moveCardWithSwap(character, fromSlot, toSlot) {
  const fromRoot = getRootSlotId(character, fromSlot);
  if (!fromRoot) return { ok: false };
  const moving = character.slots[fromRoot];
  if (!moving || moving.type === "linked") return { ok: false };
  const targetRoot = getRootSlotId(character, toSlot);
  if (targetRoot === fromRoot) return { ok: true };

  const targetSlots = getTargetSlots(toSlot, moving);
  if (!targetSlots.length) return { ok: false, message: "這個位置不符合物品的格數或部位限制" };

  const snapshot = cloneSlots(character.slots);
  const sourceSlots = getCardSlotIds(character, fromRoot);
  const displaced = getDisplacedCards(character, targetSlots, new Set([moving.id]));

  removeCardAt(character, fromRoot);
  displaced.forEach(({ origin }) => removeCardAt(character, origin));

  if (!placeCard(character, toSlot, moving)) {
    character.slots = snapshot;
    return { ok: false, message: "這個位置放不下這張卡片" };
  }

  if (!placeDisplacedCards(character, displaced, fromRoot, sourceSlots)) {
    character.slots = snapshot;
    return { ok: false, message: "交換失敗：空間不足或部位不符合" };
  }

  return { ok: true };
}

function cloneSlots(slots) {
  return JSON.parse(JSON.stringify(slots));
}

function removeCardAt(character, slotId) {
  const root = getRootSlotId(character, slotId);
  if (!root) return;
  clearSlotLinks(character, root);
  character.slots[root] = null;
}

function getRootSlotId(character, slotId) {
  const card = character.slots[slotId];
  if (!card) return slotId;
  if (card.type !== "linked") return slotId;
  return Object.keys(character.slots).find((key) => character.slots[key]?.id === card.parent) || null;
}

function getCardSlotIds(character, rootSlotId) {
  const card = character.slots[rootSlotId];
  if (!card || card.type === "linked") return [];
  return [rootSlotId, ...Object.keys(character.slots).filter((key) => character.slots[key]?.type === "linked" && character.slots[key].parent === card.id)];
}

function getDisplacedCards(character, slotIds, ignoredIds = new Set()) {
  const seen = new Set();
  const displaced = [];
  slotIds.forEach((slotId) => {
    const root = getRootSlotId(character, slotId);
    if (!root) return;
    const card = character.slots[root];
    if (!card || card.type === "linked" || ignoredIds.has(card.id) || seen.has(card.id)) return;
    seen.add(card.id);
    displaced.push({ origin: root, card });
  });
  return displaced;
}

function placeDisplacedCards(character, displaced, fromRoot, sourceSlots) {
  if (!displaced.length) return true;
  return placeDisplacedCardAtIndex(character, displaced, 0, fromRoot, sourceSlots);
}

function placeDisplacedCardAtIndex(character, displaced, index, fromRoot, sourceSlots) {
  if (index >= displaced.length) return true;
  const { card, origin } = displaced[index];
  const candidates = getSwapCandidateSlots(card, fromRoot, sourceSlots, origin);
  for (const slotId of candidates) {
    const snapshot = cloneSlots(character.slots);
    if (placeCard(character, slotId, card) && placeDisplacedCardAtIndex(character, displaced, index + 1, fromRoot, sourceSlots)) {
      return true;
    }
    character.slots = snapshot;
  }
  return false;
}

function placePackDisplacedCards(character, displaced, index) {
  if (index >= displaced.length) return true;
  const { card } = displaced[index];
  for (const slot of packSlots) {
    const snapshot = cloneSlots(character.slots);
    if (placeCard(character, slot.id, card) && placePackDisplacedCards(character, displaced, index + 1)) {
      return true;
    }
    character.slots = snapshot;
  }
  return false;
}

function getSwapCandidateSlots(card, fromRoot, sourceSlots, originalOrigin) {
  const pageSlots = fromRoot.startsWith("pack") ? packSlots : equipSlots;
  return unique([
    fromRoot,
    ...sourceSlots,
    originalOrigin,
    ...pageSlots.map((slot) => slot.id),
    ...packSlots.map((slot) => slot.id),
  ]).filter((slotId) => getTargetSlots(slotId, card).length);
}

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function clearSlotLinks(character, slotId) {
  const card = character.slots[slotId];
  if (!card || card.type === "linked") return;
  Object.keys(character.slots).forEach((key) => {
    if (character.slots[key]?.type === "linked" && character.slots[key].parent === card.id) {
      character.slots[key] = null;
    }
  });
}

function placeCard(character, slotId, card) {
  const placement = getTargetPlacement(slotId, card);
  const targetSlots = placement.slots;
  if (!targetSlots.length || !areSlotsAvailable(character, targetSlots)) return false;
  character.slots[targetSlots[0]] = { ...card, placedShape: placement.shape || getSlotShape(card) };
  targetSlots.slice(1).forEach((linkedSlot) => {
    character.slots[linkedSlot] = { type: "linked", parent: card.id };
  });
  return true;
}

function placeCardWithAutoArrange(character, slotId, card) {
  if (placeCard(character, slotId, card)) return true;
  if (!slotId.startsWith("pack")) return false;

  const targetSlots = getTargetSlots(slotId, card);
  if (!targetSlots.length) return false;

  const snapshot = cloneSlots(character.slots);
  const displaced = getDisplacedCards(character, targetSlots);
  displaced.forEach(({ origin }) => removeCardAt(character, origin));

  if (!placeCard(character, targetSlots[0], card) || !placePackDisplacedCards(character, displaced, 0)) {
    character.slots = snapshot;
    return false;
  }

  return true;
}

function canPlaceCard(character, slotId, card) {
  const targetSlots = getTargetPlacement(slotId, card).slots;
  return !!targetSlots.length && areSlotsAvailable(character, targetSlots);
}

function canPlaceCardWithAutoArrange(character, slotId, card) {
  const testCharacter = { ...character, slots: cloneSlots(character.slots) };
  return placeCardWithAutoArrange(testCharacter, slotId, { ...card });
}

function areSlotsAvailable(character, slotIds) {
  return slotIds.every((slotId) => slotId && !character.slots[slotId]);
}

function findFirstFittingSlot(character, card, originalSlotId) {
  const slots = originalSlotId?.startsWith("pack") ? packSlots : equipSlots;
  return slots.find((slot) => canPlaceCard(character, slot.id, card))?.id || null;
}

function getTargetSlots(slotId, card) {
  return getTargetPlacement(slotId, card).slots;
}

function getTargetPlacement(slotId, card) {
  const slot = getSlotInfo(slotId);
  if (!slot) return { slots: [], shape: getSlotShape(card) };
  if (slot.region !== "pack") {
    const slots = getEquipmentTargetSlots(slot, card);
    return { slots, shape: getShapeFromSlots(slots) || getSlotShape(card) };
  }
  return getPackTargetPlacement(slot, card);
}

function getPackTargetPlacement(slot, card) {
  if (Number(card.slots || 1) === 1) return { slots: [slot.id], shape: "1x1" };
  const shape = getBaseSlotShape(card);
  const candidates = packSlots
    .map((candidate) => ({
      slots: getGridTargetSlots(packSlots, candidate, card, shape),
      shape,
    }))
    .filter((placement) => placement.slots.includes(slot.id));
  const direct = candidates.find((placement) => placement.slots[0] === slot.id);
  if (direct) return direct;
  return candidates
    .sort((a, b) => {
      const aStart = getSlotInfo(a.slots[0]);
      const bStart = getSlotInfo(b.slots[0]);
      const aDistance = Math.abs(aStart.row - slot.row) + Math.abs(aStart.col - slot.col);
      const bDistance = Math.abs(bStart.row - slot.row) + Math.abs(bStart.col - slot.col);
      return aDistance - bDistance;
    })[0] || { slots: [], shape: getSlotShape(card) };
}

function getEquipmentTargetSlots(slot, card) {
  const rule = getEquipRule(card);
  const slots = Number(card.slots || 1);
  if (slots === 1) {
    if (rule === "paw" && slot.region !== "paw") return [];
    if (rule === "body" && slot.region !== "body") return [];
    return [slot.id];
  }

  if (rule === "twoPaws") {
    if (slot.region !== "paw") return [];
    return ["mainPaw", "offPaw"];
  }
  if (rule === "body") {
    if (slot.region !== "body") return [];
    return ["bodyA", "bodyB"];
  }
  if (rule === "bodyPaw") {
    if (slot.row === 0 && (slot.id === "mainPaw" || slot.id === "bodyA")) return ["mainPaw", "bodyA"];
    if (slot.row === 1 && (slot.id === "offPaw" || slot.id === "bodyB")) return ["offPaw", "bodyB"];
    return [];
  }
  const targetSlots = getGridTargetSlots(equipSlots, slot, card);
  return targetSlots.length && isEquipmentTargetAllowed(targetSlots, rule) ? targetSlots : [];
}

function getGridTargetSlots(pageSlots, startSlot, card, shapeOverride) {
  const shape = getShapeSize(card, shapeOverride);
  const targetSlots = [];
  for (let row = startSlot.row; row < startSlot.row + shape.height; row += 1) {
    for (let col = startSlot.col; col < startSlot.col + shape.width; col += 1) {
      const slot = pageSlots.find((candidate) => candidate.row === row && candidate.col === col);
      if (!slot) return [];
      targetSlots.push(slot.id);
    }
  }
  return targetSlots;
}

function isEquipmentTargetAllowed(slotIds, rule) {
  if (rule === "any") return true;
  const regions = slotIds.map((slotId) => getSlotInfo(slotId)?.region);
  if (rule === "paw") return regions.every((region) => region === "paw");
  if (rule === "twoPaws") return slotIds.includes("mainPaw") && slotIds.includes("offPaw");
  if (rule === "body") return regions.every((region) => region === "body");
  if (rule === "bodyPaw") return regions.includes("body") && regions.includes("paw");
  return true;
}

function getShapeSize(card, shapeOverride) {
  const shape = shapeOverride || getSlotShape(card);
  if (Number(card.slots || 1) !== 2) return { width: 1, height: 1 };
  return shape === "2x1" ? { width: 2, height: 1 } : { width: 1, height: 2 };
}

function getSlotShape(card) {
  if (card.placedShape) return card.placedShape;
  return getBaseSlotShape(card);
}

function getBaseSlotShape(card) {
  if (card.slotShape) return card.slotShape;
  if (card.slotGroup === "paws" || card.slotGroup === "body") return "1x2";
  return Number(card.slots || 1) === 2 ? "1x2" : "1x1";
}

function getShapeFromSlots(slotIds) {
  if (slotIds.length !== 2) return slotIds.length === 1 ? "1x1" : "";
  const [first, second] = slotIds.map(getSlotInfo);
  if (!first || !second) return "";
  return first.row === second.row ? "2x1" : "1x2";
}

function getEquipRule(card) {
  if (card.equipRule) return card.equipRule;
  if (card.slotGroup === "paws") return "twoPaws";
  if (card.slotGroup === "body") return "body";
  return "any";
}

function getSlotInfo(slotId) {
  return [...equipSlots, ...packSlots].find((slot) => slot.id === slotId);
}

function openEmptySlotMenu(slotId) {
  const isPack = slotId.startsWith("pack");
  openContext("", `
    <button class="primary" data-add-item>新增物品</button>
    ${isPack ? `<button class="secondary" data-add-condition>新增狀態</button>` : ""}
  `, (menu) => {
    menu.querySelector("[data-add-item]").addEventListener("click", () => {
      closeContext();
      openItemModal(slotId);
    });
    menu.querySelector("[data-add-condition]")?.addEventListener("click", () => {
      closeContext();
      openConditionModal(slotId);
    });
  });
}

function openCardMenu(slotId) {
  const card = activeCharacter().slots[slotId];
  const effect = card.category === "法術" ? card.note : "";
  const removeText = card.type === "condition" ? getConditionRemove(card) : "";
  openContext(card.name, `
    ${renderMenuUsageDots(card, slotId)}
    ${effect ? `<p class="card-effect">${escapeHtml(effect)}</p>` : ""}
    ${removeText ? `<p class="card-effect condition-remove">${escapeHtml(removeText)}</p>` : ""}
    <button class="danger" data-delete>刪除</button>
  `, (menu) => {
    menu.querySelectorAll("[data-menu-dot]").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        const index = Number(dot.dataset.menuDotIndex);
        updateCharacter((character) => {
          const target = character.slots[slotId];
          target.usage = index < target.usage ? index : index + 1;
        });
        const updated = activeCharacter().slots[slotId];
        syncMenuUsageDots(menu, Number(updated?.usage || 0));
      });
    });
    menu.querySelector("[data-delete]").addEventListener("click", () => {
      closeContext();
      updateCharacter((character) => {
        clearSlotLinks(character, slotId);
        character.slots[slotId] = null;
      });
    });
  });
}

function getConditionEffect(card) {
  return splitConditionDetail(card.effect || card.detail || "").effect;
}

function getConditionRemove(card) {
  const parts = splitConditionDetail(card.remove || card.effect || card.detail || "");
  return parts.remove || card.remove || "";
}

function renderMenuUsageDots(card, slotId) {
  if (!card.usageMax) return "";
  return `<div class="menu-usage-dots" aria-label="使用點">
    ${Array.from({ length: card.usageMax || 0 }, (_, index) => `<button class="dot ${index < card.usage ? "filled" : ""}" data-menu-dot="${slotId}" data-menu-dot-index="${index}" aria-label="使用點 ${index + 1}"></button>`).join("")}
  </div>`;
}

function syncMenuUsageDots(menu, usage) {
  menu.querySelectorAll("[data-menu-dot]").forEach((dot) => {
    dot.classList.toggle("filled", Number(dot.dataset.menuDotIndex) < usage);
  });
}

function openContext(title, body, binder) {
  const backdrop = document.createElement("div");
  backdrop.className = "context-backdrop";
  backdrop.innerHTML = `<div class="context-menu">${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<div class="settings-list">${body}</div></div>`;
  document.body.appendChild(backdrop);
  const menu = backdrop.querySelector(".context-menu");
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeContext();
  });
  binder(menu);
}

function closeContext() {
  document.querySelector(".context-backdrop")?.remove();
}

function openModal(title, body, binder) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal"><h2>${escapeHtml(title)}</h2>${body}</div>`;
  document.body.appendChild(backdrop);
  const modal = backdrop.querySelector(".modal");
  modal.querySelector("[data-cancel]")?.addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  binder(modal, () => backdrop.remove());
}

function openIdentityModal() {
  const character = activeCharacter();
  openModal("編輯名字/出身", `
    <div class="form-grid">
      <label class="field">名字<input data-name value="${escapeAttr(character.name)}"></label>
      <label class="field">出身<input data-origin value="${escapeAttr(character.origin)}"></label>
    </div>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        target.name = modal.querySelector("[data-name]").value || "無名";
        target.origin = modal.querySelector("[data-origin]").value || "未知出身";
      });
      close();
    });
  });
}

function openNumberModal(title, current, onSave) {
  openModal(title, `
    <label class="field">數值<input data-value type="number" min="0" value="${current}"></label>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      onSave(Number(modal.querySelector("[data-value]").value || 0));
      close();
    });
  });
}

function openNotesModal() {
  const character = activeCharacter();
  openModal("筆記", `
    <textarea class="notes-editor" data-notes-edit rows="8" placeholder="記下傷口、約定、欠債或奇怪的夢。">${escapeHtml(character.notes)}</textarea>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        target.notes = modal.querySelector("[data-notes-edit]").value;
      });
      close();
    });
  });
}

function openXpSheet() {
  const character = activeCharacter();
  openBottomSheet("目前擁有的經驗值", `
    <div class="form-grid">
      <label class="field">等級<input data-level-edit type="number" min="1" max="10" value="${character.level}"></label>
      <label class="field">經驗值<input data-xp-edit type="number" min="0" value="${character.xp}"></label>
      <input class="xp-input" type="range" min="0" max="99" value="${character.xp}" data-xp-range>
    </div>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (sheet, close) => {
    const xpInput = sheet.querySelector("[data-xp-edit]");
    const xpRange = sheet.querySelector("[data-xp-range]");
    xpInput.addEventListener("input", () => { xpRange.value = clamp(Number(xpInput.value), 0, 99); });
    xpRange.addEventListener("input", () => { xpInput.value = xpRange.value; });
    sheet.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        target.level = clamp(Number(sheet.querySelector("[data-level-edit]").value || 1), 1, 10);
        target.xp = Math.max(0, Number(xpInput.value || 0));
        target.grit = target.grit.slice(0, Math.max(0, target.level - 1));
      });
      close();
    });
  });
}

function openHpSheet() {
  const character = activeCharacter();
  openBottomSheet("生命值", `
    <div class="form-grid">
      <label class="field">最大生命值<input data-hp-max-edit type="number" min="0" value="${character.hp.max}"></label>
      <label class="field">目前生命值<input data-hp-current-edit type="number" min="0" value="${character.hp.current}"></label>
    </div>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (sheet, close) => {
    sheet.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        const max = Math.max(0, Number(sheet.querySelector("[data-hp-max-edit]").value || 0));
        target.hp.max = max;
        target.hp.current = clamp(Number(sheet.querySelector("[data-hp-current-edit]").value || 0), 0, max);
      });
      close();
    });
  });
}

function openMoneySheet() {
  const character = activeCharacter();
  const maxMoney = moneyLimit(character);
  openBottomSheet("金錢", `
    <label class="field">目前金錢<input data-money-edit type="number" min="0" max="${maxMoney}" value="${Number(character.money || 0)}"></label>
    <p class="field-hint">上限：${maxMoney}</p>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (sheet, close) => {
    sheet.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        target.money = clamp(Number(sheet.querySelector("[data-money-edit]").value || 0), 0, moneyLimit(target));
      });
      close();
    });
  });
}

function openStatSheet(key) {
  const stat = activeCharacter().stats[key];
  openBottomSheet(stat.label, `
    <div class="form-grid">
      <label class="field">最大值<input data-stat-max-edit type="number" min="0" value="${stat.max}"></label>
      <label class="field">目前值<input data-stat-current-edit type="number" min="0" value="${stat.current}"></label>
    </div>
    <div class="actions"><button class="primary" data-save>儲存</button></div>
  `, (sheet, close) => {
    sheet.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((target) => {
        const max = Math.max(0, Number(sheet.querySelector("[data-stat-max-edit]").value || 0));
        target.stats[key].max = max;
        target.stats[key].current = clamp(Number(sheet.querySelector("[data-stat-current-edit]").value || 0), 0, max);
      });
      close();
    });
  });
}

function openBottomSheet(title, body, binder) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop bottom-sheet-backdrop";
  backdrop.innerHTML = `<div class="modal bottom-sheet"><h2>${escapeHtml(title)}</h2>${body}</div>`;
  document.body.appendChild(backdrop);
  const sheet = backdrop.querySelector(".bottom-sheet");
  const close = () => backdrop.remove();
  sheet.querySelector("[data-cancel]")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  binder(sheet, close);
}

function openItemModal(slotId) {
  const character = activeCharacter();
  const categories = getItemCategories();
  const firstCategory = categories[0] || "物品";
  openModal("新增物品", `
    <button class="modal-close-x" data-close-item-modal aria-label="關閉">X</button>
    <div class="catalog-tabs">
      ${categories.map((category) => `<button class="catalog-tab ${category === firstCategory ? "active" : ""}" data-catalog-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join("")}
    </div>
    <div class="catalog-list" data-catalog-list>
      ${renderCatalogList(firstCategory, slotId, character)}
    </div>
    <div class="actions"><button class="primary" data-custom>自訂物品</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-close-item-modal]").addEventListener("click", close);
    const bindPickButtons = () => {
      modal.querySelectorAll("[data-pick-item]").forEach((button) => {
        button.addEventListener("click", () => {
          const item = itemPresets[Number(button.dataset.pickItem)];
          updateCharacter((character) => {
            placeCardWithAutoArrange(character, slotId, makeItem(item));
          });
          close();
        });
      });
    };
    bindPickButtons();
    modal.querySelectorAll("[data-catalog-category]").forEach((button) => {
      button.addEventListener("click", () => {
        modal.querySelectorAll("[data-catalog-category]").forEach((tab) => tab.classList.toggle("active", tab === button));
        modal.querySelector("[data-catalog-list]").innerHTML = renderCatalogList(button.dataset.catalogCategory, slotId, activeCharacter());
        bindPickButtons();
      });
    });
    modal.querySelector("[data-custom]").addEventListener("click", () => {
      close();
      openCustomItemModal(slotId);
    });
  });
}

function getItemCategories() {
  return unique(itemPresets.map((item) => getItemCategory(item)));
}

function getItemCategory(item) {
  return item.category || "物品";
}

function renderCatalogList(category, slotId, character) {
  return itemPresets
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => getItemCategory(item) === category)
    .map(({ item, index }) => renderCatalogButton(item, index, slotId, character))
    .join("");
}

function renderCatalogButton(item, index, slotId, character) {
  const disabled = canPlaceCardWithAutoArrange(character, slotId, { ...item, slots: Number(item.slots || 1) }) ? "" : "disabled";
  const disabledText = disabled ? " · 目前放不下" : "";
  const category = getItemCategory(item);
  const shouldShowMeta = !["物品", "法術"].includes(category);
  const meta = shouldShowMeta ? [item.kind, item.damage, item.armor, item.note].filter(Boolean).join(" · ") : "";
  const detail = [meta, disabled ? "目前放不下" : ""].filter(Boolean).join(" · ");
  return `
    <button class="catalog-card" data-pick-item="${index}" ${disabled}>
      ${renderSlotFootprint(item)}
      <span class="catalog-art">${renderCardArt(item)}</span>
      <span class="catalog-copy"><strong>${escapeHtml(item.name)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span>
    </button>
  `;
}

function renderSlotFootprint(item) {
  const slots = Number(item.slots || 1);
  const shape = slots === 2 ? getBaseSlotShape(item) : "1x1";
  return `<span class="slot-footprint footprint-${shape}" aria-label="${slots}格">
    <span></span>
    ${slots === 2 ? "<span></span>" : ""}
  </span>`;
}

function openCustomItemModal(slotId) {
  const categories = getItemCategories();
  openModal("自訂物品", `
    <div class="form-grid">
      <label class="field">名稱<input data-name value="新物品"></label>
      <label class="field">類別<select data-category>
        ${unique([...categories, "戰鬥", "物品", "法術"]).map((category) => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join("")}
      </select></label>
      <label class="field">屬性<input data-kind placeholder="例如 輕型、重型遠程、彈藥"></label>
      <label class="field">usage<input data-usage-max type="number" min="0" max="6" value="3"></label>
      <label class="field">占用格數<select data-slots><option value="1">1 格</option><option value="2">2 格</option></select></label>
      <label class="field">格子排法<select data-slot-shape><option value="">自動</option><option value="1x2">1x2 直向</option><option value="2x1">2x1 橫向</option></select></label>
      <label class="field">部位限定<select data-equip-rule>
        <option value="any">不限</option>
        <option value="paw">爪</option>
        <option value="twoPaws">兩爪</option>
        <option value="body">身體</option>
        <option value="bodyPaw">身體+爪</option>
      </select></label>
      <label class="field">骰子<input data-damage placeholder="例如 d6 或 d6/d8"></label>
      <label class="field">護甲值<input data-armor placeholder="例如 1"></label>
      <label class="field">效果<textarea data-note rows="3"></textarea></label>
    </div>
    <div class="actions"><button class="primary" data-save>新增</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((character) => {
        placeCardWithAutoArrange(character, slotId, makeItem({
          name: modal.querySelector("[data-name]").value,
          kind: modal.querySelector("[data-kind]").value,
          icon: "blank",
          usageMax: modal.querySelector("[data-usage-max]").value,
          slots: modal.querySelector("[data-slots]").value,
          slotShape: normalizeSlotShape(modal.querySelector("[data-slot-shape]").value),
          equipRule: normalizeEquipRule(modal.querySelector("[data-equip-rule]").value),
          damage: modal.querySelector("[data-damage]").value,
          armor: normalizeArmor(modal.querySelector("[data-armor]").value),
          note: modal.querySelector("[data-note]").value,
          category: modal.querySelector("[data-category]").value,
        }));
      });
      close();
    });
  });
}

function openConditionModal(slotId) {
  openModal("新增狀態", `
    <div class="catalog-list">
      ${conditionPresets.map((condition, index) => `
        <button class="catalog-card condition-pick" data-pick-condition="${index}">
          <span class="catalog-art">${renderCardArt({ type: "condition" })}</span>
          <span class="catalog-copy"><strong>${escapeHtml(condition.name)}</strong>${getConditionEffect(condition) ? `<small>${escapeHtml(getConditionEffect(condition))}</small>` : ""}</span>
        </button>
      `).join("")}
    </div>
    <div class="actions"><button class="primary" data-custom>自訂狀態</button></div>
  `, (modal, close) => {
    modal.querySelectorAll("[data-pick-condition]").forEach((button) => {
      button.addEventListener("click", () => {
        const condition = conditionPresets[Number(button.dataset.pickCondition)];
        updateCharacter((character) => {
          placeCard(character, slotId, makeCondition(condition));
        });
        close();
      });
    });
    modal.querySelector("[data-custom]").addEventListener("click", () => {
      close();
      openCustomConditionModal(slotId);
    });
  });
}

function openCustomConditionModal(slotId) {
  openModal("自訂狀態", `
    <div class="form-grid">
      <label class="field">名稱<input data-name value="自訂狀態"></label>
      <label class="field">效果<textarea data-effect rows="3" placeholder="卡片上顯示的效果"></textarea></label>
      <label class="field">移除條件<textarea data-remove rows="2" placeholder="例如 移除：短休之後"></textarea></label>
    </div>
    <div class="actions"><button class="primary" data-save>新增</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      updateCharacter((character) => {
        placeCard(character, slotId, makeCondition({
          name: modal.querySelector("[data-name]").value,
          effect: modal.querySelector("[data-effect]").value,
          remove: modal.querySelector("[data-remove]").value,
        }));
      });
      close();
    });
  });
}

function openSettings() {
  openModal("設定", `
    <div class="settings-list">
      <button data-characters>角色</button>
      <button data-import>輸入種子碼</button>
    </div>
    <div class="actions"></div>
  `, (modal, close) => {
    modal.querySelector("[data-characters]").addEventListener("click", () => {
      close();
      openCharactersModal();
    });
    modal.querySelector("[data-import]").addEventListener("click", () => {
      close();
      openImportModal();
    });
  });
}

function openCharactersModal() {
  const current = activeCharacter();
  openModal("角色", `
    <div class="character-list">
      ${state.characters.map((character) => `
        <div class="character-row">
          <strong>${escapeHtml(character.name)}</strong>
          <button class="secondary" data-switch="${character.id}">${character.id === current.id ? "使用中" : "切換"}</button>
          <button class="danger" data-remove="${character.id}" ${state.characters.length === 1 ? "disabled" : ""}>刪除</button>
        </div>
      `).join("")}
    </div>
    <div class="actions">
      
      <button class="secondary" data-export>匯出種子碼</button>
      <button class="primary" data-new>新增角色</button>
    </div>
  `, (modal, close) => {
    modal.querySelectorAll("[data-switch]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeCharacterId = button.dataset.switch;
        saveState();
        close();
        render();
      });
    });
    modal.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        state.characters = state.characters.filter((character) => character.id !== button.dataset.remove);
        state.activeCharacterId = state.characters[0].id;
        saveState();
        close();
        render();
      });
    });
    modal.querySelector("[data-new]").addEventListener("click", () => {
      const character = makeCharacter("新老鼠");
      state.characters.push(character);
      state.activeCharacterId = character.id;
      saveState();
      close();
      render();
    });
    modal.querySelector("[data-export]").addEventListener("click", () => {
      const seed = encodeSeed(activeCharacter());
      modal.querySelector("[data-seed-output]")?.remove();
      modal.insertAdjacentHTML("beforeend", `
        <div class="seed-output" data-seed-output>
          <label class="field">角色種子碼<textarea readonly data-export-seed rows="5">${seed}</textarea></label>
          <button class="primary" data-copy-seed>複製種子碼</button>
        </div>
      `);
      modal.querySelector("[data-copy-seed]").addEventListener("click", async () => {
        const textarea = modal.querySelector("[data-export-seed]");
        textarea.select();
        try {
          await navigator.clipboard.writeText(seed);
          modal.querySelector("[data-copy-seed]").textContent = "已複製";
        } catch {
          document.execCommand("copy");
          modal.querySelector("[data-copy-seed]").textContent = "已複製";
        }
      });
    });
  });
}

function openImportModal() {
  openModal("輸入種子碼", `
    <label class="field">種子碼<textarea data-seed rows="7"></textarea></label>
    <div class="actions"><button class="primary" data-save>匯入</button></div>
  `, (modal, close) => {
    modal.querySelector("[data-save]").addEventListener("click", () => {
      try {
        const imported = decodeSeed(modal.querySelector("[data-seed]").value.trim());
        imported.id = uid();
        state.characters.push(imported);
        state.activeCharacterId = imported.id;
        saveState();
        close();
        render();
      } catch {
        modal.querySelector("[data-seed]").style.borderColor = "var(--red)";
      }
    });
  });
}

function encodeSeed(character) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(character))));
}

function decodeSeed(seed) {
  const character = JSON.parse(decodeURIComponent(escape(atob(seed))));
  if (!character.name || !character.slots || !character.stats) throw new Error("Invalid seed");
  return character;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function loadDatabasePresets() {
  try {
    const response = await fetch(`${DATABASE_CSV_URL}&cacheBust=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
    const rows = parseCsv(await response.text());
    const records = csvRowsToRecords(rows);
    const nextItems = [];
    const nextConditions = [];

    records.forEach((record) => {
      const type = getRecordValue(record, ["databaseType", "資料類型", "卡片類型", "type"]).toLowerCase();
      const name = getRecordValue(record, ["name", "名稱", "名字", "物品", "狀態"]);
      if (!name) return;
      const category = getRecordValue(record, ["category", "類別"]);
      const looksLikeCondition = ["condition", "status", "狀態", "狀態卡"].includes(type)
        || ["condition", "status", "狀態", "狀態卡"].includes(category.toLowerCase());

      if (looksLikeCondition) {
        const detail = getRecordValue(record, ["detail", "說明", "描述"]);
        nextConditions.push({
          name,
          effect: getRecordValue(record, ["effect", "效果"]) || splitConditionDetail(detail).effect,
          remove: getRecordValue(record, ["remove", "移除", "移除條件"]) || splitConditionDetail(detail).remove,
          detail,
        });
        return;
      }

      if (!type || ["item", "物品", "物品卡", "weapon", "armor", "gear", "equipment", "裝備"].includes(type)) {
        nextItems.push({
          name,
          kind: getRecordValue(record, ["kind", "屬性", "物品類型", "分類"]) || "物品",
          icon: getRecordValue(record, ["icon", "圖示", "素材", "圖片"]) || "blank",
          usageMax: Number(getRecordValue(record, ["usageMax", "usage", "使用點", "使用次數", "點數"]) || 0),
          damage: getRecordValue(record, ["damage", "骰子", "傷害", "傷害骰"]),
          armor: normalizeArmor(getRecordValue(record, ["armor", "護甲值", "護甲"])),
          slots: Number(getRecordValue(record, ["slots", "占用格數", "格數", "占格"]) || 1),
          slotShape: normalizeSlotShape(getRecordValue(record, ["slotShape", "格子排法", "形狀", "方向", "占用方向"])),
          equipRule: normalizeEquipRule(getRecordValue(record, ["equipRule", "部位限定", "裝備規則", "部位"])),
          note: getRecordValue(record, ["note", "備註", "效果", "上限"]),
          category: category || "物品",
        });
      }
    });

    if (nextItems.length) itemPresets.splice(0, itemPresets.length, ...nextItems);
    if (nextConditions.length) conditionPresets.splice(0, conditionPresets.length, ...nextConditions);
  } catch {
    // Keep bundled data when the sheet is private, offline, or not published yet.
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function csvRowsToRecords(rows) {
  const headers = rows[0]?.map((header) => header.trim()) || [];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

function getRecordValue(record, keys) {
  const normalizedKeys = keys.map(normalizeHeader);
  const entry = Object.entries(record).find(([key]) => normalizedKeys.includes(normalizeHeader(key)));
  return entry?.[1]?.trim?.() || "";
}

function normalizeHeader(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeSlotShape(value) {
  const shape = String(value || "").trim().toLowerCase();
  if (["2x1", "橫", "橫向", "horizontal"].includes(shape)) return "2x1";
  if (["1x2", "直", "直向", "vertical"].includes(shape)) return "1x2";
  return "";
}

function normalizeArmor(value) {
  const armor = String(value || "").trim();
  if (!armor) return "";
  return armor.includes("護甲") ? armor : `${armor}護甲`;
}

function normalizeEquipRule(value) {
  const rule = String(value || "").trim();
  const map = {
    主副爪: "twoPaws",
    雙爪: "twoPaws",
    兩爪: "twoPaws",
    爪: "paw",
    手: "paw",
    身體: "body",
    身體加爪: "bodyPaw",
    身體爪: "bodyPaw",
    "身體+爪": "bodyPaw",
  };
  return map[rule] || rule || "any";
}

function splitConditionDetail(detail) {
  const text = String(detail || "").trim();
  if (!text) return { effect: "", remove: "" };
  const removeIndex = text.indexOf("移除");
  if (removeIndex < 0) return { effect: text, remove: "" };
  if (removeIndex === 0) return { effect: "", remove: text };
  return {
    effect: text.slice(0, removeIndex).replace(/[；;。\s]+$/, "").trim(),
    remove: text.slice(removeIndex).trim(),
  };
}

async function bootstrap() {
  await loadDatabasePresets();
  render();
}

bootstrap();
