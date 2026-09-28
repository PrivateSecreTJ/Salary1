"use strict";

/* =========================
   基本設定
========================= */

const $ = (id) => document.getElementById(id);
const MONEY = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 0
});

const LEAVES = {
  annual:      { name: "特休", rate: 1, bonusCut: 0 },
  personal:    { name: "事假", rate: 0, bonusCut: 500 },
  sick:        { name: "病假", rate: 0.5, bonusCut: 100 },
  menstrual:   { name: "生理假", rate: 0.5, bonusCut: 0 },
  family:      { name: "家庭照顧假", rate: 0, bonusCut: 0 },
  official:    { name: "公假", rate: 1, bonusCut: 0 },
  marriage:    { name: "婚假", rate: 1, bonusCut: 0 },
  bereavement: { name: "喪假", rate: 1, bonusCut: 0 },
  injury:      { name: "公傷假", rate: 1, bonusCut: 0 },
  maternity:   { name: "產假", rate: 1, bonusCut: 0 },
  prenatal:    { name: "產檢假", rate: 1, bonusCut: 0 },
  paternity:   { name: "陪產檢及陪產假", rate: 1, bonusCut: 0 },
  disaster:    { name: "天然災害假", rate: 1, bonusCut: 0 },
  absence:     { name: "曠職", rate: 0, bonusCut: 500 }
};

const DAY_NAMES = {
  weekday: "平日",
  rest: "休息日",
  regularHoliday: "例假日",
  nationalHoliday: "國定假日"
};

const WEEK_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

const state = {
  days: {},
  activeDate: null,
  selectedBulkDates: new Set()
};

/* =========================
   日期工具
   使用本地日期，避免 UTC 時區造成日期跑掉
========================= */

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getPeriodDates() {
  const start = parseDate($("periodStart").value);
  const end = parseDate($("periodEnd").value);

  if (!start || !end || start > end) return [];

  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(new Date(date));

    // 防止誤輸入非常長的日期範圍導致頁面卡住
    if (dates.length > 62) return [];
  }

  return dates;
}

function defaultDayType(date) {
  if (date.getDay() === 0) return "regularHoliday";
  if (date.getDay() === 6) return "rest";
  return "weekday";
}

function getDay(date) {
  const key = dateKey(date);
  return state.days[key] || {
    type: defaultDayType(date),
    work: null,
    leaveType: "",
    leave: 0,
    overtime: 0,
    filled: false
  };
}

function setDefaultPeriod() {
  const agency = $("employeeType").value.startsWith("agency");
  const boundary = agency ? 26 : 16;
  const endDay = agency ? 25 : 15;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // 顯示最近一個已開始的計薪週期
  const startMonth =
    today.getDate() >= boundary ? month : month - 1;

  const start = new Date(year, startMonth, boundary, 12);
  const end = new Date(year, startMonth + 1, endDay, 12);

  $("periodStart").value = dateKey(start);
  $("periodEnd").value = dateKey(end);
  renderCalendar();
}

/* =========================
   畫面與日曆
========================= */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function numberValue(id) {
  const value = Number($(id).value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function numberText(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

function money(value) {
  return `NT$ ${MONEY.format(Math.round(value))}`;
}

function updateIdentity() {
  const agency = $("employeeType").value.startsWith("agency");

  $("regularInputs").hidden = agency;
  $("agencyInputs").hidden = !agency;

  updateRates();
  renderResults();
}

function renderCalendar() {
  const dates = getPeriodDates();
  const calendar = $("calendar");
  calendar.replaceChildren();

  if (!dates.length) {
    calendar.innerHTML =
      '<p class="empty-state" style="grid-column:1/-1">請填入有效日期；單次計薪週期最多 62 天。</p>';
    $("periodLabel").textContent = "";
    renderResults();
    return;
  }

  const heading = WEEK_NAMES.map(
    (name) => `<div class="weekday-name">星期${name}</div>`
  ).join("");

  const blanks = '<div class="calendar-blank"></div>'.repeat(
    dates[0].getDay()
  );

  const cells = dates.map((date) => {
    const key = dateKey(date);
    const day = getDay(date);
    const holiday = day.type !== "weekday";
    const work =
      day.type === "weekday" && day.work !== null && day.work > 0
        ? `<span class="day-detail day-work">上班 ${numberText(day.work)} 小時</span>`
        : "";

    const leave =
      day.type === "weekday" && day.leave > 0 && LEAVES[day.leaveType]
        ? `<span class="day-detail ${
            day.leaveType === "absence" ? "day-absence" : "day-leave"
          }">${LEAVES[day.leaveType].name} ${numberText(day.leave)} 小時</span>`
        : "";

    const overtime =
      day.overtime > 0
        ? `<span class="day-detail day-overtime">加班 ${numberText(day.overtime)} 小時</span>`
        : "";

    return `
      <button
        type="button"
        class="day-cell ${holiday ? "is-holiday" : ""} ${
          day.filled ? "is-filled" : ""
        }"
        data-date="${key}"
        aria-label="${date.getMonth() + 1}月${date.getDate()}日，${DAY_NAMES[day.type]}，點選編輯"
      >
        <span class="day-date">
          ${date.getDate()}
          <small>${date.getMonth() + 1}月</small>
        </span>
        <span class="day-kind">${DAY_NAMES[day.type]}</span>
        ${work}${leave}${overtime}
      </button>
    `;
  }).join("");

  calendar.innerHTML = heading + blanks + cells;

  $("periodLabel").textContent =
    `目前週期：${$("periodStart").value.replaceAll("-", "/")} ～ ` +
    `${$("periodEnd").value.replaceAll("-", "/")}，共 ${dates.length} 天`;

  renderResults();
}

function openDay(dateString) {
  const date = parseDate(dateString);
  if (!date) return;

  state.activeDate = dateString;
  const day = getDay(date);

  $("dayDialogTitle").textContent =
    `${date.getMonth() + 1} 月 ${date.getDate()} 日（星期${WEEK_NAMES[date.getDay()]}）`;

  $("dayType").value = day.type;
  $("workHours").value =
    day.work === null ? "" : numberText(day.work);
  $("leaveType").value = day.leaveType || "";
  $("leaveHours").value =
    day.leave > 0 ? numberText(day.leave) : "";
  $("overtimeHours").value =
    day.overtime > 0 ? numberText(day.overtime) : "";
  $("dayError").textContent = "";

  toggleWeekdayFields();
  $("dayDialog").showModal();
}

function toggleWeekdayFields() {
  $("weekdayFields").hidden = $("dayType").value !== "weekday";
}

function adjustWorkForLeave() {
  if ($("dayType").value !== "weekday") return;

  const leave = Number($("leaveHours").value);
  if ($("leaveType").value && $("leaveHours").value !== "" &&
      Number.isFinite(leave) && leave >= 0 && leave <= 8) {
    $("workHours").value = numberText(8 - leave);
  }
}

function saveDay(event) {
  event.preventDefault();

  const date = parseDate(state.activeDate);
  if (!date) return;

  const type = $("dayType").value;
  const weekday = type === "weekday";
  const workInput = $("workHours").value.trim();
  const leaveInput = $("leaveHours").value.trim();
  const overtimeInput = $("overtimeHours").value.trim();

  const work = weekday && workInput !== "" ? Number(workInput) : null;
  const leaveType = weekday ? $("leaveType").value : "";
  const leave = weekday && leaveInput !== "" ? Number(leaveInput) : 0;
  const overtime = overtimeInput !== "" ? Number(overtimeInput) : 0;

  let error = "";

  if (
    (work !== null && (!Number.isFinite(work) || work < 0 || work > 8)) ||
    !Number.isFinite(leave) || leave < 0 || leave > 8 ||
    !Number.isFinite(overtime) || overtime < 0 || overtime > 24
  ) {
    error = "請輸入有效時數：上班與請假為 0～8，加班為 0～24。";
  } else if (weekday && leave > 0 && !leaveType) {
    error = "有填請假時數時，請選擇假別。";
  } else if (weekday && leaveType && leave === 0) {
    error = "選擇假別後，請填入大於 0 的請假時數。";
  } else if (weekday && leave > 0 && work + leave !== 8) {
    error = "有請假時，上班時數＋請假時數必須等於 8。";
  }

  if (error) {
    $("dayError").textContent = error;
    return;
  }

  state.days[state.activeDate] = {
    type,
    work,
    leaveType,
    leave,
    overtime,
    filled: true
  };

  $("dayDialog").close();
  renderCalendar();
}

function clearDay() {
  if (!state.activeDate) return;

  delete state.days[state.activeDate];
  $("dayDialog").close();
  renderCalendar();
}

function fillWeekdays() {
  const dates = getPeriodDates();
  if (!dates.length) return;

  for (const date of dates) {
    const key = dateKey(date);
    const old = getDay(date);

    // 保留已改成假日的日期，也保留既有加班時數
    if (old.type !== "weekday") continue;

    state.days[key] = {
      ...old,
      work: 8,
      leaveType: "",
      leave: 0,
      filled: true
    };
  }

  renderCalendar();
}

/* =========================
   批量加班
========================= */

function renderBulkDates() {
  const dates = getPeriodDates();
  state.selectedBulkDates = new Set(
    [...state.selectedBulkDates].filter((key) =>
      dates.some((date) => dateKey(date) === key)
    )
  );

  $("bulkDates").innerHTML = dates.map((date) => {
    const key = dateKey(date);
    const day = getDay(date);

    return `
      <button
        type="button"
        class="bulk-date ${
          state.selectedBulkDates.has(key) ? "selected" : ""
        } ${day.type !== "weekday" ? "holiday" : ""}"
        data-bulk-date="${key}"
        aria-pressed="${state.selectedBulkDates.has(key)}"
      >
        ${date.getMonth() + 1}/${date.getDate()}（${WEEK_NAMES[date.getDay()]}）
      </button>
    `;
  }).join("");

  $("bulkCount").textContent = `已選 ${state.selectedBulkDates.size} 天`;
}

function openBulkDialog() {
  if (!getPeriodDates().length) {
    alert("請先設定有效的計薪週期。");
    return;
  }

  state.selectedBulkDates.clear();
  $("bulkHours").value = "";
  $("bulkError").textContent = "";
  renderBulkDates();
  $("bulkDialog").showModal();
}

function applyBulkOvertime() {
  const raw = $("bulkHours").value.trim();
  const hours = Number(raw);

  if (
    raw === "" ||
    !Number.isFinite(hours) ||
    hours < 0 ||
    hours > 24
  ) {
    $("bulkError").textContent = "請填寫 0～24 小時的加班時數。";
    return;
  }

  if (!state.selectedBulkDates.size) {
    $("bulkError").textContent = "請至少選擇一個日期。";
    return;
  }

  for (const key of state.selectedBulkDates) {
    const date = parseDate(key);
    if (!date) continue;

    state.days[key] = {
      ...getDay(date),
      overtime: hours,
      filled: true
    };
  }

  $("bulkDialog").close();
  renderCalendar();
}

/* =========================
   加班計算
========================= */

function overtimeBuckets(type, hours, agency) {
  const result = {
    x1: 0,
    x134: 0,
    x167: 0,
    x2: 0,
    x267: 0
  };

  if (type === "weekday") {
    result.x134 = Math.min(hours, 2);
    result.x167 = Math.max(hours - 2, 0);
  } else if (type === "rest") {
    result.x134 = Math.min(hours, 2);
    result.x167 = Math.min(Math.max(hours - 2, 0), 6);
    result.x267 = Math.max(hours - 8, 0);
  } else if (type === "nationalHoliday") {
    if (agency) {
      result.x2 = Math.min(hours, 8);
    } else {
      result.x1 = Math.min(hours, 8);
    }

    result.x134 = Math.min(Math.max(hours - 8, 0), 2);
    result.x167 = Math.max(hours - 10, 0);
  } else if (type === "regularHoliday") {
    result.x2 = hours;
  }

  return result;
}

function addBuckets(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source[key];
  }
}

function emptyBuckets() {
  return { x1: 0, x134: 0, x167: 0, x2: 0, x267: 0 };
}

function calculateBucketPay(buckets, rates) {
  return (
    buckets.x1 * rates.x1 +
    buckets.x134 * rates.x134 +
    buckets.x167 * rates.x167 +
    buckets.x2 * rates.x2 +
    buckets.x267 * rates.x267
  );
}

function updateRates() {
  const base = numberValue("hourlyWage") + numberValue("hourlyAllowance");
  const rates = [
    ["1.34 倍", Math.round(base * 1.34)],
    ["1.67 倍", Math.round(base * 1.67)],
    ["2 倍", Math.round(base * 2)],
    ["2.67 倍", Math.round(base * 2.67)]
  ];

  $("rateCards").innerHTML = rates.map(([label, amount]) => `
    <div class="rate-card">
      <strong>${money(amount)}</strong>
      <span>${label}／小時</span>
    </div>
  `).join("");
}

/* =========================
   薪資計算
========================= */

function calculatePay() {
  const agency = $("employeeType").value.startsWith("agency");
  const night = $("employeeType").value.endsWith("night");
  const dates = getPeriodDates();

  if (!dates.length) return null;

  const baseSalary = numberValue("baseSalary");
  const foodAllowance = 3000;
  const originalBonus = numberValue("attendanceBonus");
  const labor = numberValue("laborInsurance");
  const health = numberValue("healthInsurance");
  const normalHourly = numberValue("hourlyWage");
  const attendanceHourly = numberValue("hourlyAllowance");

  let bonusCut = 0;
  let regularLeaveDeductionHours = 0;
  let nightAllowance = 0;
  let mealAllowance = 0;
  let sundayNightBonus = 0;
  let sundayMealBonus = 0;
  let agencyNormalPay = 0;
  let agencyLeavePay = 0;

  const overtime = {
    weekday: emptyBuckets(),
    rest: emptyBuckets(),
    nationalHoliday: emptyBuckets(),
    regularHoliday: emptyBuckets()
  };

  for (const date of dates) {
    const day = getDay(date);
    const work = day.type === "weekday"
      ? Math.max(day.work ?? 0, 0)
      : 0;
    const leave = day.type === "weekday"
      ? Math.max(day.leave || 0, 0)
      : 0;
    const overtimeHours = Math.max(day.overtime || 0, 0);
    const leaveRule = LEAVES[day.leaveType];

    if (leave > 0 && leaveRule) {
      // 每個有請假的日期最多算一次扣全勤
      bonusCut += leaveRule.bonusCut;

      if (agency) {
        agencyLeavePay += leave * normalHourly * leaveRule.rate;
      } else {
        regularLeaveDeductionHours += leave * (1 - leaveRule.rate);
      }
    }

    if (agency) {
      // 派遣只有實際上班時數才有出勤津貼
      agencyNormalPay += work * (normalHourly + attendanceHourly);
    }

    addBuckets(
      overtime[day.type],
      overtimeBuckets(day.type, overtimeHours, agency)
    );

    if (night) {
      const isSundayHoliday = day.type === "regularHoliday";

      if (agency) {
        if (
          (day.type === "weekday" && overtimeHours >= 2) ||
          (day.type !== "weekday" && overtimeHours >= 10)
        ) {
          mealAllowance += 40;
        }
      } else {
        // 正職夜班：星期一至星期六，依實際出勤時數計算
        if (date.getDay() !== 0) {
          const attendedHours =
            day.type === "weekday" ? work : overtimeHours;

          nightAllowance +=
            415 * Math.min(attendedHours, 8) / 8;
        }

        if (isSundayHoliday) {
          if (overtimeHours > 0) sundayNightBonus += 415;
          if (overtimeHours > 10) sundayMealBonus += 40;
        } else if (
          (day.type === "weekday" && overtimeHours >= 2) ||
          (day.type !== "weekday" && overtimeHours >= 10)
        ) {
          mealAllowance += 40;
        }
      }
    }
  }

  if (agency) {
    // 派遣加班費率：先取整數，再乘時數
    const combinedHourly = normalHourly + attendanceHourly;
    const rates = {
      x1: Math.round(combinedHourly),
      x134: Math.round(combinedHourly * 1.34),
      x167: Math.round(combinedHourly * 1.67),
      x2: Math.round(combinedHourly * 2),
      x267: Math.round(combinedHourly * 2.67)
    };

    const overtimePays = Object.fromEntries(
      Object.entries(overtime).map(([type, buckets]) => [
        type,
        calculateBucketPay(buckets, rates)
      ])
    );

    const overtimeTotal = Object.values(overtimePays)
      .reduce((sum, amount) => sum + amount, 0);

    const gross =
      agencyNormalPay +
      agencyLeavePay +
      overtimeTotal +
      mealAllowance;

    return {
      agency: true,
      night,
      normalPay: agencyNormalPay,
      leavePay: agencyLeavePay,
      overtime,
      overtimePays,
      overtimeTotal,
      mealAllowance,
      gross,
      net: gross
    };
  }

  const structure = baseSalary + foodAllowance;
  const paidBonus = Math.max(originalBonus - bonusCut, 0);

  // 夜班津貼加入計算加班費的平均時薪
  const averageHourly =
    (structure + paidBonus + nightAllowance) / 240;

  const rates = {
    x1: averageHourly,
    x134: averageHourly * 1.34,
    x167: averageHourly * 1.67,
    x2: averageHourly * 2,
    x267: averageHourly * 2.67
  };

  const overtimePays = Object.fromEntries(
    Object.entries(overtime).map(([type, buckets]) => [
      type,
      calculateBucketPay(buckets, rates)
    ])
  );

  // 例假日加班費另列獎金，不放進一般加班費
  const regularOvertime =
    overtimePays.weekday +
    overtimePays.rest +
    overtimePays.nationalHoliday;

  const separateBonus =
    overtimePays.regularHoliday +
    sundayNightBonus +
    sundayMealBonus;

  const leaveDeduction =
    (structure / 240) * regularLeaveDeductionHours;

  const additions =
    paidBonus +
    regularOvertime +
    nightAllowance +
    mealAllowance;

  const welfare =
    (structure + paidBonus + regularOvertime + nightAllowance) * 0.005;

  const deductions =
    welfare + labor + health + leaveDeduction;

  const gross = structure + additions + separateBonus;
  const net = gross - deductions;

  return {
    agency: false,
    night,
    baseSalary,
    foodAllowance,
    structure,
    originalBonus,
    bonusCut,
    paidBonus,
    averageHourly,
    overtime,
    overtimePays,
    regularOvertime,
    nightAllowance,
    mealAllowance,
    sundayNightBonus,
    sundayMealBonus,
    separateBonus,
    welfare,
    labor,
    health,
    leaveDeduction,
    additions,
    deductions,
    gross,
    net
  };
}

/* =========================
   結果顯示
========================= */

function row(label, value, className = "") {
  return `
    <div class="result-row ${className}">
      <span>${escapeHTML(label)}</span>
      <span>${money(value)}</span>
    </div>
  `;
}

function detailRow(label, value) {
  return `
    <div class="result-row">
      <span>${escapeHTML(label)}</span>
      <span>${escapeHTML(numberText(value))} 小時</span>
    </div>
  `;
}

function overtimePanel(title, buckets, amount) {
  const labels = {
    x1: "1 倍",
    x134: "1.34 倍",
    x167: "1.67 倍",
    x2: "2 倍",
    x267: "2.67 倍"
  };

  const details = Object.entries(buckets)
    .filter(([, hours]) => hours > 0)
    .map(([key, hours]) => detailRow(labels[key], hours))
    .join("");

  if (!details) return "";

  return `
    <div class="result-panel">
      <h3>${escapeHTML(title)}</h3>
      ${details}
      ${row("本類加班費", amount, "total")}
    </div>
  `;
}

function renderResults() {
  const result = calculatePay();

  if (!result) {
    $("results").innerHTML =
      '<p class="empty-state">請先設定有效的計薪週期。</p>';
    return;
  }

  const overtimeDetails = [
    overtimePanel(
      "一般工作日加班",
      result.overtime.weekday,
      result.overtimePays.weekday
    ),
    overtimePanel(
      "休息日加班",
      result.overtime.rest,
      result.overtimePays.rest
    ),
    overtimePanel(
      "國定假日加班",
      result.overtime.nationalHoliday,
      result.overtimePays.nationalHoliday
    ),
    overtimePanel(
      "例假日加班",
      result.overtime.regularHoliday,
      result.overtimePays.regularHoliday
    )
  ].join("");

  let sections;

  if (result.agency) {
    sections = `
      <div class="result-panel">
        <h3>薪資收入</h3>
        ${row("正常上班薪資（含出勤津貼）", result.normalPay)}
        ${result.leavePay > 0
          ? row("有薪請假薪資", result.leavePay)
          : ""}
        ${result.overtimeTotal > 0
          ? row("加班費", result.overtimeTotal)
          : ""}
        ${result.mealAllowance > 0
          ? row("早餐津貼", result.mealAllowance)
          : ""}
        ${row("薪資收入合計", result.gross, "total")}
      </div>

      <div class="result-panel">
        <h3>計算方式</h3>
        <div class="result-row">
          <span>正常上班</span>
          <span>常態時薪＋出勤津貼</span>
        </div>
        <div class="result-row">
          <span>請假時</span>
          <span>僅依常態時薪給薪</span>
        </div>
        <div class="result-row">
          <span>例假日加班</span>
          <span>併入一般加班費</span>
        </div>
        <p class="result-note">
          這個版本的派遣試算未設定其他扣款欄位，
          所以實領薪資目前等於應領薪資。
        </p>
      </div>
    `;
  } else {
    sections = `
      <div class="result-panel">
        <h3>薪資結構</h3>
        ${row("底薪", result.baseSalary)}
        ${row("伙食津貼", result.foodAllowance)}
        ${row("薪資結構合計", result.structure, "total")}
      </div>

      <div class="result-panel">
        <h3>薪資加項</h3>
        ${row("全勤獎金", result.paidBonus)}
        ${result.bonusCut > 0
          ? row("本期全勤獎金扣減", result.bonusCut)
          : ""}
        ${result.regularOvertime > 0
          ? row("加班費", result.regularOvertime)
          : ""}
        ${result.nightAllowance > 0
          ? row("夜班津貼", result.nightAllowance)
          : ""}
        ${result.mealAllowance > 0
          ? row("加班誤餐費", result.mealAllowance)
          : ""}
        ${row("加項合計", result.additions, "total")}
      </div>

      <div class="result-panel">
        <h3>薪資扣項</h3>
        ${row("福利金", result.welfare, "negative")}
        ${row("勞保費", result.labor, "negative")}
        ${row("健保費", result.health, "negative")}
        ${result.leaveDeduction > 0
          ? row("假勤扣款", result.leaveDeduction, "negative")
          : ""}
        ${row("扣項合計", result.deductions, "total negative")}
      </div>

      <div class="result-panel">
        <h3>額外加班費獎金</h3>
        ${row("例假日加班費", result.overtimePays.regularHoliday)}
        ${result.sundayNightBonus > 0
          ? row("例假日夜班津貼", result.sundayNightBonus)
          : ""}
        ${result.sundayMealBonus > 0
          ? row("例假日加班誤餐費", result.sundayMealBonus)
          : ""}
        ${row("額外獎金合計", result.separateBonus, "total")}
        <p class="result-note">
          額外獎金已計入下方應領與實領薪資；
          它與一般加班費分開顯示。
        </p>
      </div>
    `;
  }

  $("results").innerHTML = `
    <div class="results-layout">
      ${sections}
      ${overtimeDetails}
    </div>

    <div class="result-summary">
      <div class="summary-tile">
        <span>應領薪資</span>
        <strong>${money(result.gross)}</strong>
      </div>
      <div class="summary-tile net">
        <span>實領薪資</span>
        <strong>${money(result.net)}</strong>
      </div>
    </div>
  `;
}

/* =========================
   本機存檔

   localStorage 是瀏覽器本機資料，不是加密保險箱。
   請勿把驗證碼設成其他網站正在使用的密碼。
========================= */

function storageKey() {
  const employeeId = $("employeeId").value.trim();
  const accessCode = $("accessCode").value;

  if (!employeeId || !accessCode) return null;

  return `personal-payroll-v1:${employeeId}:${accessCode}`;
}

function showSaveStatus(message, type = "") {
  $("saveStatus").textContent = message;
  $("saveStatus").className = `status ${type}`.trim();
}

function saveData() {
  const key = storageKey();

  if (!key) {
    showSaveStatus("請填寫工號與驗證碼", "error");
    return;
  }

  const data = {
    version: 1,
    employeeType: $("employeeType").value,
    periodStart: $("periodStart").value,
    periodEnd: $("periodEnd").value,
    baseSalary: $("baseSalary").value,
    attendanceBonus: $("attendanceBonus").value,
    laborInsurance: $("laborInsurance").value,
    healthInsurance: $("healthInsurance").value,
    hourlyWage: $("hourlyWage").value,
    hourlyAllowance: $("hourlyAllowance").value,
    days: state.days
  };

  try {
    localStorage.setItem(key, JSON.stringify(data));
    showSaveStatus("已儲存於此瀏覽器", "success");
  } catch {
    showSaveStatus("儲存失敗：瀏覽器可能禁止本機儲存", "error");
  }
}

function loadData() {
  const key = storageKey();

  if (!key) {
    showSaveStatus("請填寫工號與驗證碼", "error");
    return;
  }

  let saved;

  try {
    saved = localStorage.getItem(key);
  } catch {
    showSaveStatus("無法讀取瀏覽器資料", "error");
    return;
  }

  if (!saved) {
    showSaveStatus("找不到對應存檔", "error");
    return;
  }

  try {
    const data = JSON.parse(saved);

    const allowedTypes = [
      "regular-day",
      "regular-night",
      "agency-day",
      "agency-night"
    ];

    $("employeeType").value = allowedTypes.includes(data.employeeType)
      ? data.employeeType
      : "regular-day";

    $("periodStart").value = data.periodStart || "";
    $("periodEnd").value = data.periodEnd || "";

    for (const id of [
      "baseSalary",
      "attendanceBonus",
      "laborInsurance",
      "healthInsurance",
      "hourlyWage",
      "hourlyAllowance"
    ]) {
      $(id).value = data[id] ?? "";
    }

    state.days =
      data.days && typeof data.days === "object" && !Array.isArray(data.days)
        ? data.days
        : {};

    updateIdentity();
    renderCalendar();
    showSaveStatus("已讀取存檔", "success");
  } catch {
    showSaveStatus("存檔內容無法讀取", "error");
  }
}

/* =========================
   事件綁定與啟動
========================= */

$("employeeType").addEventListener("change", () => {
  updateIdentity();
  setDefaultPeriod();
});

$("periodStart").addEventListener("change", renderCalendar);
$("periodEnd").addEventListener("change", renderCalendar);
$("defaultPeriodBtn").addEventListener("click", setDefaultPeriod);
$("generateBtn").addEventListener("click", renderCalendar);

$("fullAttendanceBtn").addEventListener("click", fillWeekdays);
$("bulkOvertimeBtn").addEventListener("click", openBulkDialog);

$("calendar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (button) openDay(button.dataset.date);
});

$("dayType").addEventListener("change", toggleWeekdayFields);
$("leaveType").addEventListener("change", adjustWorkForLeave);
$("leaveHours").addEventListener("input", adjustWorkForLeave);
$("dayForm").addEventListener("submit", saveDay);
$("clearDayBtn").addEventListener("click", clearDay);

$("bulkDates").addEventListener("click", (event) => {
  const button = event.target.closest("[data-bulk-date]");
  if (!button) return;

  const key = button.dataset.bulkDate;

  if (state.selectedBulkDates.has(key)) {
    state.selectedBulkDates.delete(key);
  } else {
    state.selectedBulkDates.add(key);
  }

  renderBulkDates();
});

$("bulkSelectWeekdays").addEventListener("click", () => {
  for (const date of getPeriodDates()) {
    if (getDay(date).type === "weekday") {
      state.selectedBulkDates.add(dateKey(date));
    }
  }
  renderBulkDates();
});

$("bulkClearSelection").addEventListener("click", () => {
  state.selectedBulkDates.clear();
  renderBulkDates();
});

$("applyBulkBtn").addEventListener("click", applyBulkOvertime);

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    $(button.dataset.close).close();
  });
});

for (const id of [
  "baseSalary",
  "attendanceBonus",
  "laborInsurance",
  "healthInsurance",
  "hourlyWage",
  "hourlyAllowance"
]) {
  $(id).addEventListener("input", () => {
    updateRates();
    renderResults();
  });
}

$("saveBtn").addEventListener("click", saveData);
$("loadBtn").addEventListener("click", loadData);

setDefaultPeriod();
updateIdentity();