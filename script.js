"use strict";

/* =========================================================
   個人薪資計算系統
   script.js
========================================================= */


/* =========================================================
   01. 基本設定
========================================================= */

const MEAL_ALLOWANCE = 3000;
const NIGHT_ALLOWANCE_PER_DAY = 415;
const OVERTIME_MEAL_ALLOWANCE = 40;


/*
    假別設定

    payFactor：
    1   = 全薪
    0.5 = 半薪
    0   = 無薪

    attendanceDeduction：
    當天有該假別時，全勤扣多少
*/

const LEAVE_RULES = {

    annual: {
        name: "特休",
        payFactor: 1,
        attendanceDeduction: 0
    },

    official: {
        name: "公假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    marriage: {
        name: "婚假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    bereavement: {
        name: "喪假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    occupational: {
        name: "公傷假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    maternity: {
        name: "產假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    prenatal: {
        name: "產檢假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    paternity: {
        name: "陪產檢及陪產假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    disaster: {
        name: "天然災害假",
        payFactor: 1,
        attendanceDeduction: 0
    },

    sick: {
        name: "病假",
        payFactor: 0.5,
        attendanceDeduction: 100
    },

    menstrual: {
        name: "生理假",
        payFactor: 0.5,
        attendanceDeduction: 0
    },

    personal: {
        name: "事假",
        payFactor: 0,
        attendanceDeduction: 500
    },

    family: {
        name: "家庭照顧假",
        payFactor: 0,
        attendanceDeduction: 0
    },

    absence: {
        name: "曠職",
        payFactor: 0,
        attendanceDeduction: 500
    }
};


const DAY_TYPE_NAMES = {

    weekday: "平日",
    rest: "休息日",
    holiday: "例假日",
    national: "國定假日"
};


const EMPLOYEE_TYPE_NAMES = {

    "regular-day": "正職日班",
    "regular-night": "正職夜班",
    "agency-day": "派遣日班",
    "agency-night": "派遣夜班"
};


/* =========================================================
   02. 系統狀態
========================================================= */

let attendanceData = {};

let editingDateKey = null;

let toastTimer = null;


/* =========================================================
   03. DOM 快速取得
========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   04. 初始化
========================================================= */

document.addEventListener("DOMContentLoaded", init);


function init() {

    bindEvents();

    updateEmployeeTypeUI();

    updateAgencyRates();

    updateLeaveEditor();

    /*
        如果 HTML 已經選了身分類型，
        自動設定計薪週期。
    */

    if ($("employeeType").value) {

        setDefaultPayPeriod();

        generateCalendar();
    }
}


/* =========================================================
   05. 綁定事件
========================================================= */

function bindEvents() {

    $("employeeType").addEventListener(
        "change",
        () => {

            updateEmployeeTypeUI();

            setDefaultPayPeriod();

            generateCalendar();
        }
    );


    $("generateCalendarBtn").addEventListener(
        "click",
        generateCalendar
    );


    $("fullAttendanceBtn").addEventListener(
        "click",
        applyFullAttendance
    );


    $("batchOvertimeBtn").addEventListener(
        "click",
        openBatchOvertimeModal
    );


    $("clearCalendarBtn").addEventListener(
        "click",
        clearAttendanceData
    );


    $("calculateSalaryBtn").addEventListener(
        "click",
        calculateSalary
    );


    $("saveDataBtn").addEventListener(
        "click",
        saveLocalData
    );


    $("loadDataBtn").addEventListener(
        "click",
        loadLocalData
    );


    /*
        派遣倍率
    */

    $("agencyHourlyRate").addEventListener(
        "input",
        updateAgencyRates
    );


    $("attendanceHourlyAllowance").addEventListener(
        "input",
        updateAgencyRates
    );


    /*
        單日 Modal
    */

    $("closeDayModalBtn").addEventListener(
        "click",
        closeDayModal
    );


    $("saveDayDataBtn").addEventListener(
        "click",
        saveDayData
    );


    $("deleteDayDataBtn").addEventListener(
        "click",
        restoreDayDefault
    );


    $("dayType").addEventListener(
        "change",
        updateDayEditor
    );


    $("leaveType").addEventListener(
        "change",
        updateLeaveEditor
    );


    /*
        請假時數輸入後，自動換算上班時數
    */

    $("leaveHours").addEventListener(
        "input",
        handleLeaveHoursChange
    );


    /*
        如果使用者手動改上班時數，
        自動同步請假時數。
    */

    $("workHours").addEventListener(
        "input",
        handleWorkHoursChange
    );


    /*
        批量加班 Modal
    */

    $("closeBatchModalBtn").addEventListener(
        "click",
        closeBatchOvertimeModal
    );


    $("cancelBatchOvertimeBtn").addEventListener(
        "click",
        closeBatchOvertimeModal
    );


    $("applyBatchOvertimeBtn").addEventListener(
        "click",
        applyBatchOvertime
    );


    $("selectAllBatchDatesBtn").addEventListener(
        "click",
        selectAllBatchDates
    );


    $("selectWeekdaysBatchBtn").addEventListener(
        "click",
        selectWeekdayBatchDates
    );


    $("clearBatchDatesBtn").addEventListener(
        "click",
        clearBatchDateSelection
    );


    /*
        點擊 Modal 背景關閉
    */

    document.querySelectorAll(
        ".modal-backdrop"
    ).forEach(backdrop => {

        backdrop.addEventListener(
            "click",
            () => {

                closeDayModal();

                closeBatchOvertimeModal();
            }
        );
    });


    /*
        ESC 關閉
    */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeDayModal();

                closeBatchOvertimeModal();
            }
        }
    );
}


/* =========================================================
   06. 身分類型
========================================================= */

function updateEmployeeTypeUI() {

    const type = $("employeeType").value;

    const isRegular =
        type === "regular-day" ||
        type === "regular-night";

    const isAgency =
        type === "agency-day" ||
        type === "agency-night";


    toggleHidden(
        $("regularSalarySettings"),
        !isRegular
    );


    toggleHidden(
        $("agencySalarySettings"),
        !isAgency
    );


    if (!type) {

        $("periodRuleText").textContent =
            "請先選擇身分類型";

        return;
    }


    if (isRegular) {

        $("periodRuleText").textContent =
            "正職預設計薪週期：上月 16 日 ～ 本月 15 日";

    } else {

        $("periodRuleText").textContent =
            "派遣預設計薪週期：上月 26 日 ～ 本月 25 日";
    }
}


/* =========================================================
   07. 預設計薪週期
========================================================= */

function setDefaultPayPeriod() {

    const type = $("employeeType").value;

    if (!type) {
        return;
    }


    const today = new Date();

    const year = today.getFullYear();

    const month = today.getMonth();


    let startDate;
    let endDate;


    const isRegular =
        type === "regular-day" ||
        type === "regular-night";


    if (isRegular) {

        /*
            上月 16 日 ～ 本月 15 日
        */

        startDate =
            new Date(
                year,
                month - 1,
                16
            );

        endDate =
            new Date(
                year,
                month,
                15
            );

    } else {

        /*
            上月 26 日 ～ 本月 25 日
        */

        startDate =
            new Date(
                year,
                month - 1,
                26
            );

        endDate =
            new Date(
                year,
                month,
                25
            );
    }


    $("periodStart").value =
        dateToKey(startDate);

    $("periodEnd").value =
        dateToKey(endDate);
}


/* =========================================================
   08. 日期工具
========================================================= */

/*
    Date → YYYY-MM-DD

    注意：
    不使用 toISOString()
    避免 UTC 時區造成日期前一天。
*/

function dateToKey(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;
}


/*
    YYYY-MM-DD → 本地 Date

    不使用 new Date("2026-09-16")
    避免瀏覽器 UTC 解讀問題。
*/

function keyToDate(key) {

    const parts =
        key.split("-")
            .map(Number);


    return new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
        12,
        0,
        0
    );
}


function formatDisplayDate(key) {

    const date =
        keyToDate(key);


    return (
        `${date.getFullYear()}/` +
        `${String(date.getMonth() + 1).padStart(2, "0")}/` +
        `${String(date.getDate()).padStart(2, "0")}`
    );
}


function getWeekdayName(key) {

    const names = [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六"
    ];


    return names[
        keyToDate(key).getDay()
    ];
}


/* =========================================================
   09. 預設日期資料
========================================================= */

function createDefaultDayData(dateKey) {

    const date =
        keyToDate(dateKey);

    const weekDay =
        date.getDay();


    let dayType =
        "weekday";


    /*
        星期六 = 休息日
        星期日 = 例假日
    */

    if (weekDay === 6) {

        dayType = "rest";

    } else if (weekDay === 0) {

        dayType = "holiday";
    }


    return {

        dateKey,

        dayType,

        workHours: 0,

        leaveType: "",

        leaveHours: 0,

        overtimeHours: 0
    };
}


/* =========================================================
   10. 產生日曆
========================================================= */

function generateCalendar() {

    const type =
        $("employeeType").value;

    const startKey =
        $("periodStart").value;

    const endKey =
        $("periodEnd").value;


    if (!type) {

        showToast(
            "請先選擇身分類型"
        );

        return;
    }


    if (!startKey || !endKey) {

        showToast(
            "請設定完整計薪週期"
        );

        return;
    }


    const startDate =
        keyToDate(startKey);

    const endDate =
        keyToDate(endKey);


    if (startDate > endDate) {

        showToast(
            "開始日期不能晚於結束日期"
        );

        return;
    }


    const calendarGrid =
        $("calendarGrid");


    calendarGrid.innerHTML = "";


    /*
        保留仍在計薪週期內的資料。
    */

    const newAttendanceData = {};


    /*
        日曆第一天前方補空格
    */

    const firstWeekday =
        startDate.getDay();


    for (
        let i = 0;
        i < firstWeekday;
        i++
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-day";

        calendarGrid.appendChild(
            empty
        );
    }


    /*
        重要修正：

        每一輪先取得獨立 dateKey 字串。

        點擊事件只傳 dateKey，
        不把 current Date 物件直接傳給事件。

        因此不會發生所有日期最後
        都變成同一天的問題。
    */

    const current =
        new Date(startDate);


    while (current <= endDate) {

        const dateKey =
            dateToKey(current);


        if (attendanceData[dateKey]) {

            newAttendanceData[dateKey] = {

                ...attendanceData[dateKey],

                dateKey
            };

        } else {

            newAttendanceData[dateKey] =
                createDefaultDayData(
                    dateKey
                );
        }


        const cell =
            createCalendarDay(
                dateKey,
                newAttendanceData[dateKey]
            );


        calendarGrid.appendChild(
            cell
        );


        current.setDate(
            current.getDate() + 1
        );
    }


    attendanceData =
        newAttendanceData;


    $("calendarPeriodText").textContent =
        `${formatDisplayDate(startKey)} ～ ${formatDisplayDate(endKey)}`;


    $("calendarSection").classList.remove(
        "hidden"
    );


    $("calculationSection").classList.remove(
        "hidden"
    );


    $("salaryResultSection").classList.add(
        "hidden"
    );
}


/* =========================================================
   11. 建立日曆格
========================================================= */

function createCalendarDay(
    dateKey,
    dayData
) {

    const date =
        keyToDate(dateKey);


    const cell =
        document.createElement("div");


    cell.className =
        "calendar-day";


    /*
        把日期直接存在 HTML dataset。

        這樣每格都有自己的日期。
    */

    cell.dataset.date =
        dateKey;


    if (
        dayData.dayType !==
        "weekday"
    ) {

        cell.classList.add(
            "holiday-day"
        );
    }


    const dayNumber =
        document.createElement("div");

    dayNumber.className =
        "day-number";


    const numberText =
        document.createElement("span");

    numberText.textContent =
        `${date.getMonth() + 1}/${date.getDate()}`;


    const typeLabel =
        document.createElement("span");

    typeLabel.className =
        "day-type-label";

    typeLabel.textContent =
        DAY_TYPE_NAMES[
            dayData.dayType
        ];


    dayNumber.appendChild(
        numberText
    );

    dayNumber.appendChild(
        typeLabel
    );


    cell.appendChild(
        dayNumber
    );


    const info =
        document.createElement("div");

    info.className =
        "day-info";


    /*
        平日才顯示工作 / 請假
    */

    if (
        dayData.dayType ===
        "weekday"
    ) {

        if (
            Number(dayData.workHours) > 0
        ) {

            info.appendChild(
                createDayInfoLine(
                    "上班",
                    `${formatHours(dayData.workHours)}h`,
                    "work-info"
                )
            );
        }


        if (
            dayData.leaveType &&
            Number(dayData.leaveHours) > 0
        ) {

            const leaveRule =
                LEAVE_RULES[
                    dayData.leaveType
                ];


            const className =
                dayData.leaveType ===
                "absence"

                    ? "leave-info absence-text"

                    : "leave-info";


            info.appendChild(
                createDayInfoLine(
                    leaveRule
                        ? leaveRule.name
                        : "請假",

                    `${formatHours(dayData.leaveHours)}h`,

                    className
                )
            );
        }
    }


    /*
        加班
    */

    if (
        Number(dayData.overtimeHours) > 0
    ) {

        info.appendChild(
            createDayInfoLine(
                "加班",
                `${formatHours(dayData.overtimeHours)}h`,
                "overtime-info"
            )
        );
    }


    cell.appendChild(
        info
    );


    /*
        ★ BUG 修正版

        不使用 current
        不使用共享 Date

        點哪一格就讀該格自己的
        data-date。
    */

    cell.addEventListener(
        "click",
        event => {

            const clickedCell =
                event.currentTarget;

            const clickedDateKey =
                clickedCell.dataset.date;


            openDayModal(
                clickedDateKey
            );
        }
    );


    return cell;
}


function createDayInfoLine(
    label,
    value,
    className
) {

    const line =
        document.createElement("div");

    line.className =
        `day-info-line ${className}`;


    const left =
        document.createElement("span");

    left.textContent =
        label;


    const right =
        document.createElement("strong");

    right.textContent =
        value;


    line.appendChild(left);

    line.appendChild(right);


    return line;
}


/* =========================================================
   12. 開啟單日編輯
========================================================= */

function openDayModal(dateKey) {

    if (!attendanceData[dateKey]) {

        attendanceData[dateKey] =
            createDefaultDayData(
                dateKey
            );
    }


    editingDateKey =
        dateKey;


    const data =
        attendanceData[dateKey];


    $("modalDateTitle").textContent =
        `${formatDisplayDate(dateKey)}　${getWeekdayName(dateKey)}`;


    $("dayType").value =
        data.dayType;


    $("workHours").value =
        numberOrBlank(
            data.workHours
        );


    $("leaveType").value =
        data.leaveType || "";


    $("leaveHours").value =
        numberOrBlank(
            data.leaveHours
        );


    $("overtimeHours").value =
        numberOrBlank(
            data.overtimeHours
        );


    updateDayEditor();

    updateLeaveEditor();


    $("dayModal").classList.remove(
        "hidden"
    );
}


/* =========================================================
   13. 日期類型編輯
========================================================= */

function updateDayEditor() {

    const dayType =
        $("dayType").value;


    const weekday =
        dayType === "weekday";


    toggleHidden(
        $("weekdayEditor"),
        !weekday
    );


    if (!weekday) {

        $("dayCalculationHint").textContent =
            "休息日、例假日與國定假日只需輸入加班時數。";

    } else {

        $("dayCalculationHint").textContent =
            "平日上班時數＋請假時數最多 8 小時。輸入請假時數時會自動換算實際上班時數。";
    }
}


/* =========================================================
   14. 請假提示
========================================================= */

function updateLeaveEditor() {

    const leaveType =
        $("leaveType").value;

    const hint =
        $("leavePayHint");


    if (!leaveType) {

        hint.textContent = "";

        hint.classList.add(
            "hidden"
        );

        return;
    }


    const rule =
        LEAVE_RULES[
            leaveType
        ];


    if (!rule) {
        return;
    }


    let payText = "";


    if (rule.payFactor === 1) {

        payText =
            "全薪假";

    } else if (
        rule.payFactor === 0.5
    ) {

        payText =
            "半薪假";

    } else {

        payText =
            "無薪假";
    }


    let deductionText =
        "不扣全勤獎金";


    if (
        rule.attendanceDeduction > 0
    ) {

        deductionText =
            `當日扣全勤獎金 ${formatMoney(rule.attendanceDeduction)}`;
    }


    hint.textContent =
        `${rule.name}｜${payText}｜${deductionText}`;


    hint.classList.remove(
        "hidden"
    );
}


/* =========================================================
   15. 請假 / 工作時數同步
========================================================= */

function handleLeaveHoursChange() {

    let leaveHours =
        getNumber(
            $("leaveHours").value
        );


    leaveHours =
        clamp(
            leaveHours,
            0,
            8
        );


    if (leaveHours > 0) {

        $("workHours").value =
            cleanNumber(
                8 - leaveHours
            );

    } else {

        /*
            沒有請假時不強制變 8，
            使用者仍可設定未出勤。
        */

        if (
            $("leaveType").value
        ) {

            $("workHours").value =
                8;
        }
    }
}


function handleWorkHoursChange() {

    let workHours =
        getNumber(
            $("workHours").value
        );


    workHours =
        clamp(
            workHours,
            0,
            8
        );


    const leaveType =
        $("leaveType").value;


    if (leaveType) {

        const leaveHours =
            8 - workHours;


        $("leaveHours").value =
            leaveHours > 0
                ? cleanNumber(leaveHours)
                : "";
    }
}


/* =========================================================
   16. 儲存單日資料
========================================================= */

function saveDayData() {

    if (!editingDateKey) {
        return;
    }


    const dayType =
        $("dayType").value;


    let workHours = 0;

    let leaveType = "";

    let leaveHours = 0;


    if (dayType === "weekday") {

        workHours =
            clamp(
                getNumber(
                    $("workHours").value
                ),
                0,
                8
            );


        leaveType =
            $("leaveType").value;


        leaveHours =
            clamp(
                getNumber(
                    $("leaveHours").value
                ),
                0,
                8
            );


        /*
            有請假時必須選假別
        */

        if (
            leaveHours > 0 &&
            !leaveType
        ) {

            showToast(
                "有請假時數時請選擇假別"
            );

            return;
        }


        /*
            有假別但沒有請假時數
        */

        if (
            leaveType &&
            leaveHours <= 0
        ) {

            showToast(
                "請輸入請假時數"
            );

            return;
        }


        /*
            上班 + 請假不能超過 8
        */

        if (
            workHours +
            leaveHours >
            8.0001
        ) {

            showToast(
                "上班時數＋請假時數不能超過 8 小時"
            );

            return;
        }


        /*
            有請假時，固定補成 8 小時
        */

        if (
            leaveHours > 0
        ) {

            workHours =
                8 - leaveHours;
        }
    }


    const overtimeHours =
        clamp(
            getNumber(
                $("overtimeHours").value
            ),
            0,
            24
        );


    attendanceData[
        editingDateKey
    ] = {

        dateKey:
            editingDateKey,

        dayType,

        workHours,

        leaveType,

        leaveHours,

        overtimeHours
    };


    closeDayModal();

    renderCalendar();

    showToast(
        `${formatDisplayDate(editingDateKey)} 已儲存`
    );
}


/* =========================================================
   17. 恢復單日預設
========================================================= */

function restoreDayDefault() {

    if (!editingDateKey) {
        return;
    }


    attendanceData[
        editingDateKey
    ] =
        createDefaultDayData(
            editingDateKey
        );


    closeDayModal();

    renderCalendar();

    showToast(
        "已恢復該日期預設值"
    );
}


/* =========================================================
   18. 關閉單日 Modal
========================================================= */

function closeDayModal() {

    $("dayModal").classList.add(
        "hidden"
    );

    editingDateKey = null;
}


/* =========================================================
   19. 重新渲染日曆
========================================================= */

function renderCalendar() {

    const startKey =
        $("periodStart").value;

    const endKey =
        $("periodEnd").value;


    if (!startKey || !endKey) {
        return;
    }


    const grid =
        $("calendarGrid");


    grid.innerHTML = "";


    const start =
        keyToDate(startKey);

    const end =
        keyToDate(endKey);


    /*
        前方空格
    */

    for (
        let i = 0;
        i < start.getDay();
        i++
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-day";

        grid.appendChild(
            empty
        );
    }


    const current =
        new Date(start);


    while (current <= end) {

        /*
            每次先建立獨立字串
        */

        const dateKey =
            dateToKey(current);


        if (!attendanceData[dateKey]) {

            attendanceData[dateKey] =
                createDefaultDayData(
                    dateKey
                );
        }


        grid.appendChild(
            createCalendarDay(
                dateKey,
                attendanceData[dateKey]
            )
        );


        current.setDate(
            current.getDate() + 1
        );
    }
}


/* =========================================================
   20. 平日一鍵全勤
========================================================= */

function applyFullAttendance() {

    const keys =
        Object.keys(
            attendanceData
        );


    if (!keys.length) {

        showToast(
            "目前沒有日曆資料"
        );

        return;
    }


    const confirmed =
        confirm(
            "確定要將所有「平日」設為上班 8 小時嗎？\n\n原本的平日請假資料會被清除，加班資料會保留。"
        );


    if (!confirmed) {
        return;
    }


    keys.forEach(key => {

        const data =
            attendanceData[key];


        if (
            data.dayType ===
            "weekday"
        ) {

            data.workHours = 8;

            data.leaveType = "";

            data.leaveHours = 0;
        }
    });


    renderCalendar();


    showToast(
        "所有平日已設定為上班 8 小時"
    );
}


/* =========================================================
   21. 清除出勤資料
========================================================= */

function clearAttendanceData() {

    const confirmed =
        confirm(
            "確定要清除本期所有出勤、請假與加班資料嗎？"
        );


    if (!confirmed) {
        return;
    }


    const startKey =
        $("periodStart").value;

    const endKey =
        $("periodEnd").value;


    attendanceData = {};


    if (
        startKey &&
        endKey
    ) {

        const start =
            keyToDate(startKey);

        const end =
            keyToDate(endKey);

        const current =
            new Date(start);


        while (
            current <= end
        ) {

            const key =
                dateToKey(current);


            attendanceData[key] =
                createDefaultDayData(
                    key
                );


            current.setDate(
                current.getDate() + 1
            );
        }
    }


    renderCalendar();


    $("salaryResultSection").classList.add(
        "hidden"
    );


    showToast(
        "本期出勤資料已清除"
    );
}


/* =========================================================
   22. 批量加班 Modal
========================================================= */

function openBatchOvertimeModal() {

    const keys =
        Object.keys(
            attendanceData
        );


    if (!keys.length) {

        showToast(
            "請先產生日曆"
        );

        return;
    }


    $("batchOvertimeHours").value =
        "";


    const list =
        $("batchDateList");


    list.innerHTML = "";


    keys
        .sort()
        .forEach(key => {

            const data =
                attendanceData[key];


            const label =
                document.createElement(
                    "label"
                );


            label.className =
                "batch-date-item";


            const checkbox =
                document.createElement(
                    "input"
                );


            checkbox.type =
                "checkbox";

            checkbox.value =
                key;

            checkbox.className =
                "batch-date-checkbox";


            const text =
                document.createElement(
                    "div"
                );


            text.className =
                "batch-date-text";


            text.innerHTML =
                `
                <strong>
                    ${formatDisplayDate(key)}
                </strong>
                <br>
                ${getWeekdayName(key)}
                ·
                ${DAY_TYPE_NAMES[data.dayType]}
                `;


            label.appendChild(
                checkbox
            );

            label.appendChild(
                text
            );


            list.appendChild(
                label
            );
        });


    $("batchOvertimeModal").classList.remove(
        "hidden"
    );
}


function closeBatchOvertimeModal() {

    $("batchOvertimeModal").classList.add(
        "hidden"
    );
}


/* =========================================================
   23. 批量日期選擇
========================================================= */

function getBatchCheckboxes() {

    return [
        ...document.querySelectorAll(
            ".batch-date-checkbox"
        )
    ];
}


function selectAllBatchDates() {

    getBatchCheckboxes()
        .forEach(box => {

            box.checked = true;
        });
}


function selectWeekdayBatchDates() {

    getBatchCheckboxes()
        .forEach(box => {

            const data =
                attendanceData[
                    box.value
                ];


            box.checked =
                data &&
                data.dayType ===
                "weekday";
        });
}


function clearBatchDateSelection() {

    getBatchCheckboxes()
        .forEach(box => {

            box.checked = false;
        });
}


/* =========================================================
   24. 套用批量加班
========================================================= */

function applyBatchOvertime() {

    const raw =
        $("batchOvertimeHours").value;


    if (
        raw === "" ||
        Number(raw) < 0
    ) {

        showToast(
            "請輸入加班時數"
        );

        return;
    }


    const hours =
        clamp(
            getNumber(raw),
            0,
            24
        );


    const selected =
        getBatchCheckboxes()
            .filter(
                box => box.checked
            );


    if (!selected.length) {

        showToast(
            "請至少選擇一個日期"
        );

        return;
    }


    selected.forEach(box => {

        const key =
            box.value;


        if (
            attendanceData[key]
        ) {

            attendanceData[key]
                .overtimeHours =
                    hours;
        }
    });


    closeBatchOvertimeModal();

    renderCalendar();


    showToast(
        `已將 ${cleanNumber(hours)} 小時加班匯入 ${selected.length} 個日期`
    );
}


/* =========================================================
   25. 派遣加班倍率
========================================================= */

function getAgencyRates() {

    const hourly =
        getNumber(
            $("agencyHourlyRate").value
        );


    const attendance =
        getNumber(
            $("attendanceHourlyAllowance").value
        );


    const base =
        hourly + attendance;


    return {

        base,

        rate134:
            Math.round(
                base * 1.34
            ),

        rate167:
            Math.round(
                base * 1.67
            ),

        rate200:
            Math.round(
                base * 2
            ),

        rate267:
            Math.round(
                base * 2.67
            )
    };
}


function updateAgencyRates() {

    const hourly =
        $("agencyHourlyRate").value;

    const allowance =
        $("attendanceHourlyAllowance").value;


    if (
        hourly === "" ||
        allowance === ""
    ) {

        $("agencyRate134").textContent =
            "—";

        $("agencyRate167").textContent =
            "—";

        $("agencyRate200").textContent =
            "—";

        $("agencyRate267").textContent =
            "—";

        return;
    }


    const rates =
        getAgencyRates();


    $("agencyRate134").textContent =
        formatNumber(
            rates.rate134
        );


    $("agencyRate167").textContent =
        formatNumber(
            rates.rate167
        );


    $("agencyRate200").textContent =
        formatNumber(
            rates.rate200
        );


    $("agencyRate267").textContent =
        formatNumber(
            rates.rate267
        );
}


/* =========================================================
   26. 計算薪資
========================================================= */

function calculateSalary() {

    const type =
        $("employeeType").value;


    if (!type) {

        showToast(
            "請先選擇身分類型"
        );

        return;
    }


    if (
        !Object.keys(
            attendanceData
        ).length
    ) {

        showToast(
            "請先產生日曆"
        );

        return;
    }


    const isRegular =
        type === "regular-day" ||
        type === "regular-night";


    let result;


    if (isRegular) {

        if (!validateRegularInputs()) {
            return;
        }


        result =
            calculateRegularSalary(
                type
            );

    } else {

        if (!validateAgencyInputs()) {
            return;
        }


        result =
            calculateAgencySalary(
                type
            );
    }


    renderSalaryResult(
        result
    );


    $("salaryResultSection").classList.remove(
        "hidden"
    );


    setTimeout(
        () => {

            $("salaryResultSection")
                .scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
        },
        100
    );
}


/* =========================================================
   27. 正職輸入驗證
========================================================= */

function validateRegularInputs() {

    const required = [

        {
            id: "baseSalary",
            name: "底薪"
        },

        {
            id: "attendanceBonus",
            name: "全勤獎金"
        },

        {
            id: "laborInsurance",
            name: "勞保費"
        },

        {
            id: "healthInsurance",
            name: "健保費"
        }
    ];


    for (
        const item of required
    ) {

        if (
            $(item.id).value === ""
        ) {

            showToast(
                `請輸入${item.name}`
            );

            $(item.id).focus();

            return false;
        }
    }


    return true;
}


/* =========================================================
   28. 派遣輸入驗證
========================================================= */

function validateAgencyInputs() {

    if (
        $("agencyHourlyRate").value === ""
    ) {

        showToast(
            "請輸入常態時薪"
        );

        $("agencyHourlyRate").focus();

        return false;
    }


    if (
        $("attendanceHourlyAllowance").value === ""
    ) {

        showToast(
            "請輸入每小時出勤津貼"
        );

        $("attendanceHourlyAllowance").focus();

        return false;
    }


    return true;
}


/* =========================================================
   29. 正職薪資
========================================================= */

function calculateRegularSalary(
    type
) {

    const isNight =
        type ===
        "regular-night";


    const baseSalary =
        getNumber(
            $("baseSalary").value
        );


    const mealAllowance =
        MEAL_ALLOWANCE;


    const originalAttendanceBonus =
        getNumber(
            $("attendanceBonus").value
        );


    const laborInsurance =
        getNumber(
            $("laborInsurance").value
        );


    const healthInsurance =
        getNumber(
            $("healthInsurance").value
        );


    /*
        全勤扣款
    */

    let attendanceDeduction =
        0;


    /*
        假勤薪資扣款
    */

    let leaveDeduction =
        0;


    /*
        底薪 + 伙食
        用於請假扣款
    */

    const leaveHourlyRate =
        (
            baseSalary +
            mealAllowance
        ) / 240;


    Object.values(
        attendanceData
    ).forEach(day => {

        if (
            day.dayType !==
            "weekday"
        ) {
            return;
        }


        if (
            !day.leaveType ||
            Number(day.leaveHours) <= 0
        ) {
            return;
        }


        const rule =
            LEAVE_RULES[
                day.leaveType
            ];


        if (!rule) {
            return;
        }


        /*
            全勤扣款：
            一天只扣一次
        */

        attendanceDeduction +=
            rule.attendanceDeduction;


        /*
            請假薪資扣款

            全薪：不扣
            半薪：扣 50%
            無薪：扣 100%
        */

        const unpaidFactor =
            1 - rule.payFactor;


        leaveDeduction +=

            leaveHourlyRate *

            Number(day.leaveHours) *

            unpaidFactor;
    });


    const adjustedAttendanceBonus =
        Math.max(
            0,

            originalAttendanceBonus -
            attendanceDeduction
        );


    /*
        夜班津貼先算。

        因為正職夜班平均時薪
        要包含本期夜班津貼。
    */

    const nightAllowance =
        isNight

            ? calculateRegularNightAllowance()

            : 0;


    /*
        平均時薪
    */

    const averageHourlyRate =

        (
            baseSalary +
            mealAllowance +
            adjustedAttendanceBonus +
            nightAllowance
        )

        / 240;


    /*
        加班
    */

    const overtime =
        calculateRegularOvertime(
            averageHourlyRate
        );


    /*
        正常加項中的誤餐費
    */

    const breakfastAllowance =
        isNight

            ? calculateRegularNightMealAllowance()

            : 0;


    /*
        星期日額外獎金

        正職：
        例假日加班費不放正常加班費，
        獨立放額外獎金。
    */

    const holidayBonus =
        overtime.holidayPay;


    let holidayNightAllowance =
        0;


    let holidayMealAllowance =
        0;


    if (isNight) {

        Object.values(
            attendanceData
        ).forEach(day => {

            if (
                day.dayType !==
                "holiday"
            ) {
                return;
            }


            const hours =
                Number(
                    day.overtimeHours
                ) || 0;


            if (hours <= 0) {
                return;
            }


            /*
                星期日有加班：
                額外 415
            */

            holidayNightAllowance +=
                NIGHT_ALLOWANCE_PER_DAY;


            /*
                星期日超過 10 小時
                才額外 40
            */

            if (hours > 10) {

                holidayMealAllowance +=
                    OVERTIME_MEAL_ALLOWANCE;
            }
        });
    }


    const extraBonusTotal =

        holidayBonus +

        holidayNightAllowance +

        holidayMealAllowance;


    /*
        正常加班費
        不包含星期日例假日
    */

    const normalOvertimePay =

        overtime.weekdayPay +

        overtime.restPay +

        overtime.nationalPay;


    /*
        加項合計
    */

    const additionTotal =

        adjustedAttendanceBonus +

        normalOvertimePay +

        nightAllowance +

        breakfastAllowance;


    /*
        福利金

        使用者規則：
        薪資結構
        + 全勤
        + 正常加班
        + 夜班津貼

        × 0.005

        誤餐費與星期日額外獎金
        不放福利金基礎。
    */

    const welfareBase =

        baseSalary +

        mealAllowance +

        adjustedAttendanceBonus +

        normalOvertimePay +

        nightAllowance;


    const welfareFee =
        welfareBase * 0.005;


    /*
        應領薪資

        假勤扣款屬扣項，
        所以應領先不扣。
    */

    const grossSalary =

        baseSalary +

        mealAllowance +

        additionTotal +

        extraBonusTotal;


    const deductionTotal =

        welfareFee +

        laborInsurance +

        healthInsurance +

        leaveDeduction;


    const netSalary =

        grossSalary -
        deductionTotal;


    return {

        mode: "regular",

        employeeType:
            type,

        baseSalary,

        mealAllowance,

        salaryStructureTotal:
            baseSalary +
            mealAllowance,

        attendanceBonus:
            adjustedAttendanceBonus,

        attendanceDeduction,

        overtimePay:
            normalOvertimePay,

        nightAllowance,

        breakfastAllowance,

        additionTotal,

        welfareFee,

        laborInsurance,

        healthInsurance,

        leaveDeduction,

        deductionTotal,

        grossSalary,

        netSalary,

        averageHourlyRate,

        overtime,

        holidayBonus,

        holidayNightAllowance,

        holidayMealAllowance,

        extraBonusTotal
    };
}


/* =========================================================
   30. 正職夜班津貼
========================================================= */

function calculateRegularNightAllowance() {

    let total = 0;


    Object.entries(
        attendanceData
    ).forEach(
        ([key, day]) => {

            const date =
                keyToDate(key);

            const weekDay =
                date.getDay();


            /*
                星期日不在正常夜班津貼，
                星期日另外算額外獎金。
            */

            if (weekDay === 0) {
                return;
            }


            /*
                平日：
                依實際上班時數比例
            */

            if (
                day.dayType ===
                "weekday"
            ) {

                const hours =
                    clamp(
                        Number(
                            day.workHours
                        ) || 0,
                        0,
                        8
                    );


                total +=

                    NIGHT_ALLOWANCE_PER_DAY *

                    (
                        hours / 8
                    );


                return;
            }


            /*
                星期六 / 其他非例假日

                使用加班時數視為出勤時數。
                最多算 8 小時。
            */

            if (
                day.dayType === "rest" ||
                day.dayType === "national"
            ) {

                const hours =
                    clamp(
                        Number(
                            day.overtimeHours
                        ) || 0,
                        0,
                        8
                    );


                total +=

                    NIGHT_ALLOWANCE_PER_DAY *

                    (
                        hours / 8
                    );
            }
        }
    );


    return total;
}


/* =========================================================
   31. 正職夜班誤餐費
========================================================= */

function calculateRegularNightMealAllowance() {

    let total = 0;


    Object.values(
        attendanceData
    ).forEach(day => {

        const overtime =
            Number(
                day.overtimeHours
            ) || 0;


        /*
            平日 >= 2h
        */

        if (
            day.dayType ===
            "weekday"
        ) {

            if (
                overtime >= 2
            ) {

                total +=
                    OVERTIME_MEAL_ALLOWANCE;
            }

            return;
        }


        /*
            休息日 / 國定假日 >= 10h

            星期日例假日不在這裡。
        */

        if (
            day.dayType === "rest" ||
            day.dayType === "national"
        ) {

            if (
                overtime >= 10
            ) {

                total +=
                    OVERTIME_MEAL_ALLOWANCE;
            }
        }
    });


    return total;
}


/* =========================================================
   32. 正職加班
========================================================= */

function calculateRegularOvertime(
    hourlyRate
) {

    const result = {

        weekday134Hours: 0,
        weekday167Hours: 0,
        weekdayPay: 0,

        rest134Hours: 0,
        rest167Hours: 0,
        rest267Hours: 0,
        restPay: 0,

        nationalBaseHours: 0,
        national134Hours: 0,
        national167Hours: 0,
        nationalPay: 0,

        holiday200Hours: 0,
        holidayPay: 0
    };


    Object.values(
        attendanceData
    ).forEach(day => {

        const hours =
            Math.max(
                0,
                Number(
                    day.overtimeHours
                ) || 0
            );


        if (hours <= 0) {
            return;
        }


        /*
            平日
        */

        if (
            day.dayType ===
            "weekday"
        ) {

            const h134 =
                Math.min(
                    hours,
                    2
                );


            const h167 =
                Math.max(
                    hours - 2,
                    0
                );


            result.weekday134Hours +=
                h134;

            result.weekday167Hours +=
                h167;


            result.weekdayPay +=

                h134 *
                hourlyRate *
                1.34

                +

                h167 *
                hourlyRate *
                1.67;


            return;
        }


        /*
            休息日
        */

        if (
            day.dayType ===
            "rest"
        ) {

            const h134 =
                Math.min(
                    hours,
                    2
                );


            const h167 =
                Math.min(
                    Math.max(
                        hours - 2,
                        0
                    ),
                    6
                );


            const h267 =
                Math.max(
                    hours - 8,
                    0
                );


            result.rest134Hours +=
                h134;

            result.rest167Hours +=
                h167;

            result.rest267Hours +=
                h267;


            result.restPay +=

                h134 *
                hourlyRate *
                1.34

                +

                h167 *
                hourlyRate *
                1.67

                +

                h267 *
                hourlyRate *
                2.67;


            return;
        }


        /*
            國定假日

            前 8 小時 × 1
            第 9～10 小時 × 1.34
            >10 × 1.67
        */

        if (
            day.dayType ===
            "national"
        ) {

            const hBase =
                Math.min(
                    hours,
                    8
                );


            const h134 =
                Math.min(
                    Math.max(
                        hours - 8,
                        0
                    ),
                    2
                );


            const h167 =
                Math.max(
                    hours - 10,
                    0
                );


            result.nationalBaseHours +=
                hBase;

            result.national134Hours +=
                h134;

            result.national167Hours +=
                h167;


            result.nationalPay +=

                hBase *
                hourlyRate

                +

                h134 *
                hourlyRate *
                1.34

                +

                h167 *
                hourlyRate *
                1.67;


            return;
        }


        /*
            例假日

            全部 × 2

            正職這筆最後會獨立放到
            額外加班費獎金。
        */

        if (
            day.dayType ===
            "holiday"
        ) {

            result.holiday200Hours +=
                hours;


            result.holidayPay +=

                hours *
                hourlyRate *
                2;
        }
    });


    return result;
}


/* =========================================================
   33. 派遣薪資
========================================================= */

function calculateAgencySalary(
    type
) {

    const isNight =
        type ===
        "agency-night";


    const hourlyRate =
        getNumber(
            $("agencyHourlyRate").value
        );


    const attendanceAllowance =
        getNumber(
            $("attendanceHourlyAllowance").value
        );


    const rates =
        getAgencyRates();


    let normalSalary = 0;

    let attendanceAllowancePay = 0;

    let leavePay = 0;

    let breakfastAllowance = 0;


    const overtime = {

        weekday134Hours: 0,
        weekday167Hours: 0,
        weekdayPay: 0,

        rest134Hours: 0,
        rest167Hours: 0,
        rest267Hours: 0,
        restPay: 0,

        nationalBaseHours: 0,
        national134Hours: 0,
        national167Hours: 0,
        nationalPay: 0,

        holiday200Hours: 0,
        holidayPay: 0
    };


    Object.values(
        attendanceData
    ).forEach(day => {

        const workHours =
            Math.max(
                0,
                Number(
                    day.workHours
                ) || 0
            );


        const leaveHours =
            Math.max(
                0,
                Number(
                    day.leaveHours
                ) || 0
            );


        const overtimeHours =
            Math.max(
                0,
                Number(
                    day.overtimeHours
                ) || 0
            );


        /*
            平日正常薪資
        */

        if (
            day.dayType ===
            "weekday"
        ) {

            normalSalary +=
                workHours *
                hourlyRate;


            attendanceAllowancePay +=
                workHours *
                attendanceAllowance;


            /*
                請假薪資

                請假不給出勤津貼。
                只依常態時薪給薪。
            */

            if (
                day.leaveType &&
                leaveHours > 0
            ) {

                const rule =
                    LEAVE_RULES[
                        day.leaveType
                    ];


                if (rule) {

                    leavePay +=

                        leaveHours *

                        hourlyRate *

                        rule.payFactor;
                }
            }


            /*
                平日加班
            */

            const h134 =
                Math.min(
                    overtimeHours,
                    2
                );


            const h167 =
                Math.max(
                    overtimeHours - 2,
                    0
                );


            overtime.weekday134Hours +=
                h134;

            overtime.weekday167Hours +=
                h167;


            overtime.weekdayPay +=

                h134 *
                rates.rate134

                +

                h167 *
                rates.rate167;


            /*
                派遣夜班
                平日加班 >=2h
                +40
            */

            if (
                isNight &&
                overtimeHours >= 2
            ) {

                breakfastAllowance +=
                    OVERTIME_MEAL_ALLOWANCE;
            }


            return;
        }


        /*
            休息日
        */

        if (
            day.dayType ===
            "rest"
        ) {

            const h134 =
                Math.min(
                    overtimeHours,
                    2
                );


            const h167 =
                Math.min(
                    Math.max(
                        overtimeHours - 2,
                        0
                    ),
                    6
                );


            const h267 =
                Math.max(
                    overtimeHours - 8,
                    0
                );


            overtime.rest134Hours +=
                h134;

            overtime.rest167Hours +=
                h167;

            overtime.rest267Hours +=
                h267;


            overtime.restPay +=

                h134 *
                rates.rate134

                +

                h167 *
                rates.rate167

                +

                h267 *
                rates.rate267;


            if (
                isNight &&
                overtimeHours >= 10
            ) {

                breakfastAllowance +=
                    OVERTIME_MEAL_ALLOWANCE;
            }


            return;
        }


        /*
            國定假日

            派遣：
            前 8h × 已取整數的 2倍
            9～10h × 1.34
            >10h × 1.67
        */

        if (
            day.dayType ===
            "national"
        ) {

            const hBase =
                Math.min(
                    overtimeHours,
                    8
                );


            const h134 =
                Math.min(
                    Math.max(
                        overtimeHours - 8,
                        0
                    ),
                    2
                );


            const h167 =
                Math.max(
                    overtimeHours - 10,
                    0
                );


            overtime.nationalBaseHours +=
                hBase;

            overtime.national134Hours +=
                h134;

            overtime.national167Hours +=
                h167;


            overtime.nationalPay +=

                hBase *
                rates.rate200

                +

                h134 *
                rates.rate134

                +

                h167 *
                rates.rate167;


            if (
                isNight &&
                overtimeHours >= 10
            ) {

                breakfastAllowance +=
                    OVERTIME_MEAL_ALLOWANCE;
            }


            return;
        }


        /*
            例假日

            派遣：
            全部 × 2
            並直接算進正常加班費。
        */

        if (
            day.dayType ===
            "holiday"
        ) {

            overtime.holiday200Hours +=
                overtimeHours;


            overtime.holidayPay +=

                overtimeHours *
                rates.rate200;


            if (
                isNight &&
                overtimeHours >= 10
            ) {

                breakfastAllowance +=
                    OVERTIME_MEAL_ALLOWANCE;
            }
        }
    });


    const overtimePay =

        overtime.weekdayPay +

        overtime.restPay +

        overtime.nationalPay +

        overtime.holidayPay;


    /*
        派遣正常薪資結構

        正常工時薪資
        + 出勤津貼
        + 有薪假薪資
    */

    const salaryStructureTotal =

        normalSalary +

        attendanceAllowancePay +

        leavePay;


    const additionTotal =

        overtimePay +

        breakfastAllowance;


    const grossSalary =

        salaryStructureTotal +

        additionTotal;


    /*
        派遣目前沒有提供：
        福利金
        勞保
        健保
        其他扣款輸入欄位

        因此實領 = 應領
    */

    const deductionTotal = 0;

    const netSalary =
        grossSalary;


    return {

        mode: "agency",

        employeeType:
            type,

        normalSalary,

        attendanceAllowancePay,

        leavePay,

        salaryStructureTotal,

        attendanceBonus: 0,

        overtimePay,

        nightAllowance: 0,

        breakfastAllowance,

        additionTotal,

        welfareFee: 0,

        laborInsurance: 0,

        healthInsurance: 0,

        leaveDeduction: 0,

        deductionTotal,

        grossSalary,

        netSalary,

        overtime,

        extraBonusTotal: 0,

        holidayBonus: 0,

        holidayNightAllowance: 0,

        holidayMealAllowance: 0
    };
}


/* =========================================================
   34. 顯示薪資結果
========================================================= */

function renderSalaryResult(
    result
) {

    const isRegular =
        result.mode ===
        "regular";


    const isAgency =
        result.mode ===
        "agency";


    const isNight =
        result.employeeType ===
            "regular-night" ||
        result.employeeType ===
            "agency-night";


    $("resultEmployeeType").textContent =
        EMPLOYEE_TYPE_NAMES[
            result.employeeType
        ] || "—";


    /*
        =========================
        薪資結構
        =========================
    */

    toggleHidden(
        $("baseSalaryResultRow"),
        !isRegular
    );


    toggleHidden(
        $("mealAllowanceResultRow"),
        !isRegular
    );


    toggleHidden(
        $("agencyNormalSalaryResultRow"),
        !isAgency
    );


    toggleHidden(
        $("agencyAttendanceAllowanceResultRow"),
        !isAgency
    );


    if (isRegular) {

        $("resultBaseSalary").textContent =
            formatMoney(
                result.baseSalary
            );


        $("resultMealAllowance").textContent =
            formatMoney(
                result.mealAllowance
            );

    } else {

        /*
            派遣的正常工時薪資
            包含有薪假的常態時薪部分，
            顯示在這裡一起呈現。
        */

        $("resultAgencyNormalSalary").textContent =
            formatMoney(
                result.normalSalary +
                result.leavePay
            );


        $("resultAgencyAttendanceAllowance").textContent =
            formatMoney(
                result.attendanceAllowancePay
            );
    }


    $("resultSalaryStructureTotal").textContent =
        formatMoney(
            result.salaryStructureTotal
        );


    /*
        =========================
        加項
        =========================
    */

    toggleHidden(
        $("attendanceBonusResultRow"),
        !isRegular
    );


    if (isRegular) {

        $("resultAttendanceBonus").textContent =
            formatMoney(
                result.attendanceBonus
            );
    }


    $("resultOvertimePay").textContent =
        formatMoney(
            result.overtimePay
        );


    /*
        正職夜班才有月夜班津貼
    */

    const showNightAllowance =
        result.employeeType ===
        "regular-night" &&
        result.nightAllowance > 0;


    toggleHidden(
        $("nightAllowanceResultRow"),
        !showNightAllowance
    );


    if (showNightAllowance) {

        $("resultNightAllowance").textContent =
            formatMoney(
                result.nightAllowance
            );
    }


    /*
        正職夜班 / 派遣夜班
        有誤餐費才顯示
    */

    const showBreakfast =
        isNight &&
        result.breakfastAllowance > 0;


    toggleHidden(
        $("breakfastAllowanceResultRow"),
        !showBreakfast
    );


    if (showBreakfast) {

        $("resultBreakfastAllowance").textContent =
            formatMoney(
                result.breakfastAllowance
            );
    }


    $("resultAdditionTotal").textContent =
        formatMoney(
            result.additionTotal
        );


    /*
        =========================
        扣項
        =========================
    */

    toggleHidden(
        $("welfareFeeResultRow"),
        !isRegular
    );


    toggleHidden(
        $("laborInsuranceResultRow"),
        !isRegular
    );


    toggleHidden(
        $("healthInsuranceResultRow"),
        !isRegular
    );


    if (isRegular) {

        $("resultWelfareFee").textContent =
            formatMoney(
                result.welfareFee
            );


        $("resultLaborInsurance").textContent =
            formatMoney(
                result.laborInsurance
            );


        $("resultHealthInsurance").textContent =
            formatMoney(
                result.healthInsurance
            );
    }


    const showLeaveDeduction =
        isRegular &&
        result.leaveDeduction > 0;


    toggleHidden(
        $("leaveDeductionResultRow"),
        !showLeaveDeduction
    );


    if (showLeaveDeduction) {

        $("resultLeaveDeduction").textContent =
            formatMoney(
                result.leaveDeduction
            );
    }


    $("resultDeductionTotal").textContent =
        formatMoney(
            result.deductionTotal
        );


    /*
        =========================
        加班明細
        =========================
    */

    renderOvertimeDetails(
        result
    );


    /*
        =========================
        正職星期日額外獎金
        =========================
    */

    renderExtraBonus(
        result
    );


    /*
        =========================
        應領 / 實領
        =========================
    */

    $("grossSalary").textContent =
        formatMoney(
            result.grossSalary
        );


    $("netSalary").textContent =
        formatMoney(
            result.netSalary
        );
}


/* =========================================================
   35. 加班明細
========================================================= */

function renderOvertimeDetails(
    result
) {

    const o =
        result.overtime;


    const weekdayHours =

        o.weekday134Hours +
        o.weekday167Hours;


    const restHours =

        o.rest134Hours +
        o.rest167Hours +
        o.rest267Hours;


    const nationalHours =

        o.nationalBaseHours +
        o.national134Hours +
        o.national167Hours;


    const holidayHours =
        o.holiday200Hours;


    const hasAny =

        weekdayHours > 0 ||
        restHours > 0 ||
        nationalHours > 0 ||
        holidayHours > 0;


    toggleHidden(
        $("overtimeDetailSection"),
        !hasAny
    );


    /*
        平日
    */

    toggleHidden(
        $("weekdayOvertimeDetail"),
        weekdayHours <= 0
    );


    if (weekdayHours > 0) {

        $("weekday134Hours").textContent =
            `${formatHours(o.weekday134Hours)} 小時`;


        $("weekday167Hours").textContent =
            `${formatHours(o.weekday167Hours)} 小時`;


        $("weekdayOvertimePay").textContent =
            formatMoney(
                o.weekdayPay
            );
    }


    /*
        休息日
    */

    toggleHidden(
        $("restDayOvertimeDetail"),
        restHours <= 0
    );


    if (restHours > 0) {

        $("rest134Hours").textContent =
            `${formatHours(o.rest134Hours)} 小時`;


        $("rest167Hours").textContent =
            `${formatHours(o.rest167Hours)} 小時`;


        $("rest267Hours").textContent =
            `${formatHours(o.rest267Hours)} 小時`;


        $("restOvertimePay").textContent =
            formatMoney(
                o.restPay
            );
    }


    /*
        國定假日
    */

    toggleHidden(
        $("nationalHolidayOvertimeDetail"),
        nationalHours <= 0
    );


    if (nationalHours > 0) {

        /*
            正職前8小時 = 1倍
            派遣前8小時 = 2倍
        */

        $("nationalBaseRateLabel").textContent =

            result.mode ===
            "agency"

                ? "2 倍"

                : "1 倍";


        $("nationalBaseHours").textContent =
            `${formatHours(o.nationalBaseHours)} 小時`;


        $("national134Hours").textContent =
            `${formatHours(o.national134Hours)} 小時`;


        $("national167Hours").textContent =
            `${formatHours(o.national167Hours)} 小時`;


        $("nationalOvertimePay").textContent =
            formatMoney(
                o.nationalPay
            );
    }


    /*
        例假日
    */

    toggleHidden(
        $("regularHolidayOvertimeDetail"),
        holidayHours <= 0
    );


    if (holidayHours > 0) {

        $("holiday200Hours").textContent =
            `${formatHours(o.holiday200Hours)} 小時`;


        $("holidayOvertimePay").textContent =
            formatMoney(
                o.holidayPay
            );
    }
}


/* =========================================================
   36. 額外獎金
========================================================= */

function renderExtraBonus(
    result
) {

    const show =
        result.mode ===
        "regular" &&
        result.extraBonusTotal > 0;


    toggleHidden(
        $("extraBonusSection"),
        !show
    );


    if (!show) {
        return;
    }


    $("resultHolidayBonus").textContent =
        formatMoney(
            result.holidayBonus
        );


    const showNight =
        result.holidayNightAllowance > 0;


    toggleHidden(
        $("holidayNightAllowanceRow"),
        !showNight
    );


    if (showNight) {

        $("resultHolidayNightAllowance").textContent =
            formatMoney(
                result.holidayNightAllowance
            );
    }


    const showMeal =
        result.holidayMealAllowance > 0;


    toggleHidden(
        $("holidayMealAllowanceRow"),
        !showMeal
    );


    if (showMeal) {

        $("resultHolidayMealAllowance").textContent =
            formatMoney(
                result.holidayMealAllowance
            );
    }


    $("resultExtraBonusTotal").textContent =
        formatMoney(
            result.extraBonusTotal
        );
}


/* =========================================================
   37. LocalStorage 儲存
========================================================= */

function getStorageKey() {

    const employeeId =
        $("employeeId")
            .value
            .trim();


    const code =
        $("verificationCode")
            .value
            .trim();


    if (
        !employeeId ||
        !code
    ) {

        return null;
    }


    return (
        "salaryCalculator:" +
        employeeId +
        ":" +
        code
    );
}


function saveLocalData() {

    const key =
        getStorageKey();


    if (!key) {

        showToast(
            "請先輸入工號與驗證碼"
        );

        return;
    }


    const data = {

        version: 2,

        employeeId:
            $("employeeId")
                .value
                .trim(),

        employeeType:
            $("employeeType").value,

        periodStart:
            $("periodStart").value,

        periodEnd:
            $("periodEnd").value,

        regular: {

            baseSalary:
                $("baseSalary").value,

            attendanceBonus:
                $("attendanceBonus").value,

            laborInsurance:
                $("laborInsurance").value,

            healthInsurance:
                $("healthInsurance").value
        },

        agency: {

            hourlyRate:
                $("agencyHourlyRate").value,

            attendanceHourlyAllowance:
                $("attendanceHourlyAllowance").value
        },

        attendanceData
    };


    try {

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );


        $("saveStatus").textContent =
            "資料已儲存";


        showToast(
            "資料已儲存在此瀏覽器"
        );

    } catch (error) {

        console.error(error);


        showToast(
            "資料儲存失敗"
        );
    }
}


/* =========================================================
   38. LocalStorage 載入
========================================================= */

function loadLocalData() {

    const key =
        getStorageKey();


    if (!key) {

        showToast(
            "請先輸入工號與驗證碼"
        );

        return;
    }


    const raw =
        localStorage.getItem(
            key
        );


    if (!raw) {

        $("saveStatus").textContent =
            "找不到資料";


        showToast(
            "找不到這組工號與驗證碼的資料"
        );

        return;
    }


    try {

        const data =
            JSON.parse(raw);


        $("employeeType").value =
            data.employeeType || "";


        $("periodStart").value =
            data.periodStart || "";


        $("periodEnd").value =
            data.periodEnd || "";


        if (data.regular) {

            $("baseSalary").value =
                data.regular
                    .baseSalary ?? "";


            $("attendanceBonus").value =
                data.regular
                    .attendanceBonus ?? "";


            $("laborInsurance").value =
                data.regular
                    .laborInsurance ?? "";


            $("healthInsurance").value =
                data.regular
                    .healthInsurance ?? "";
        }


        if (data.agency) {

            $("agencyHourlyRate").value =
                data.agency
                    .hourlyRate ?? "";


            $("attendanceHourlyAllowance").value =
                data.agency
                    .attendanceHourlyAllowance ?? "";
        }


        attendanceData =
            data.attendanceData || {};


        /*
            舊資料補 dateKey
        */

        Object.keys(
            attendanceData
        ).forEach(key => {

            attendanceData[key] = {

                ...createDefaultDayData(
                    key
                ),

                ...attendanceData[key],

                dateKey: key
            };
        });


        updateEmployeeTypeUI();

        updateAgencyRates();


        if (
            $("periodStart").value &&
            $("periodEnd").value
        ) {

            renderCalendar();


            $("calendarPeriodText").textContent =
                `${formatDisplayDate($("periodStart").value)} ～ ${formatDisplayDate($("periodEnd").value)}`;


            $("calendarSection").classList.remove(
                "hidden"
            );


            $("calculationSection").classList.remove(
                "hidden"
            );
        }


        $("salaryResultSection").classList.add(
            "hidden"
        );


        $("saveStatus").textContent =
            "資料已載入";


        showToast(
            "上次儲存資料已載入"
        );

    } catch (error) {

        console.error(error);


        showToast(
            "儲存資料格式錯誤"
        );
    }
}


/* =========================================================
   39. 通用工具
========================================================= */

function getNumber(value) {

    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : 0;
}


function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );
}


function cleanNumber(value) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {
        return "";
    }


    return Number(
        number.toFixed(2)
    );
}


function numberOrBlank(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number) ||
        number === 0
    ) {

        return "";
    }


    return cleanNumber(
        number
    );
}


function formatHours(value) {

    const number =
        Number(value) || 0;


    return Number(
        number.toFixed(2)
    ).toString();
}


function formatNumber(value) {

    const number =
        Number(value) || 0;


    return Math.round(
        number
    ).toLocaleString(
        "zh-TW"
    );
}


function formatMoney(value) {

    const number =
        Number(value) || 0;


    return (
        "$" +
        Math.round(number)
            .toLocaleString(
                "zh-TW"
            )
    );
}


function toggleHidden(
    element,
    hidden
) {

    if (!element) {
        return;
    }


    element.classList.toggle(
        "hidden",
        hidden
    );
}


/* =========================================================
   40. Toast
========================================================= */

function showToast(message) {

    const toast =
        $("toast");


    $("toastMessage").textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2600
        );
}