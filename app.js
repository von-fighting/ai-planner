/* ===== AI学习规划器 v2.0 - 精确时段版核心逻辑 ===== */
/* 作者：航哥 + 皮卡丘 ⚡ */

// ==================== 全局状态 ====================
let subjects = [];
let currentPlan = null;
let countdownTimer = null;
let currentViewMode = 'all'; // 'all' | 'week' | 'today'

const SUBJECT_COLORS = {
  '语文': '#E17055', '数学': '#6C5CE7', '英语': '#00B894',
  '物理': '#0984E3', '化学': '#FDCB6E', '生物': '#55A630',
  '历史': '#D63384', '地理': '#00B4D8', '政治': '#E8590C',
  '其他': '#636E72'
};

// ==================== 引导页控制 ====================
const LANDING_KEY = 'aiplanner_visited';

function checkLanding() {
  const visited = localStorage.getItem(LANDING_KEY);
  if (!visited) {
    // 首次访问，显示引导页
    document.getElementById('landingPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
  } else {
    // 已访问过，直接进入主应用
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
  }
}

function startUsing() {
  localStorage.setItem(LANDING_KEY, '1');
  document.getElementById('landingPage').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('mainApp').style.opacity = '0';
    requestAnimationFrame(() => {
      document.getElementById('mainApp').style.transition = 'opacity 0.4s ease';
      document.getElementById('mainApp').style.opacity = '1';
    });
  }, 350);
}

function showLanding() {
  document.getElementById('mainApp').style.display = 'none';
  const lp = document.getElementById('landingPage');
  lp.style.display = 'flex';
  lp.style.opacity = '0';
  requestAnimationFrame(() => {
    lp.style.transition = 'opacity 0.4s ease';
    lp.style.opacity = '1';
  });
}

// 时段颜色映射
const SLOT_COLORS = {
  morning:  { bg: '#FFF3E0', border: '#FF9F43', name: '早读前/早读' },
  am:       { bg: '#EBF5FF', border: '#54A0FF', name: '上午课间' },
  noon:     { bg: '#F3E8FF', border: '#5F27CD', name: '午休前' },
  pm:       { bg: '#E8FAF0', border: '#10AC84', name: '下午课间' },
  evening:  { bg: '#FFE8E0', border: '#EE5A24', name: '晚自习' },
  night:    { bg: '#ECECF0', border: '#2C3E50', name: '晚自习后' }
};

// ==================== 时段模板定义 ====================

// 工作日（周一~周五）时段
const WORKDAY_SLOTS = [
  { key: 'wd_early',           label: '🌅 早读前 / 早读',        slotType: 'morning', hint: '6:00-7:30',   defaultMins: 20, maxMins: 60 },
  { key: 'wd_morning_break',   label: '☀️ 上午课间 + 大课间',    slotType: 'am',      hint: '课间碎片',      defaultMins: 15, maxMins: 40 },
  { key: 'wd_noon',            label: '🍱 午休前（中午自习）',    slotType: 'noon',     hint: '12:00-14:00',  defaultMins: 30, maxMins: 60 },
  { key: 'wd_afternoon_break', label: '🏃 下午课间',             slotType: 'pm',       hint: '课间碎片',      defaultMins: 10, maxMins: 30 },
  { key: 'wd_evening1',        label: '📖 晚自习（第1-2节）',    slotType: 'evening',  hint: '19:00-21:00',  defaultMins: 60, maxMins: 120 },
  { key: 'wd_night',           label: '🌙 晚自习后 / 回宿舍后',  slotType: 'night',    hint: '22:00后',      defaultMins: 20, maxMins: 60 }
];

// 周六时段
const SATURDAY_SLOTS = [
  { key: 'sat_morning', label: '🌅 早晨',              slotType: 'morning', hint: '6:30-8:00',   defaultMins: 30,  maxMins: 90 },
  { key: 'sat_am',      label: '☀️ 上午自习',          slotType: 'am',      hint: '8:00-12:00',  defaultMins: 50,  maxMins: 120 },
  { key: 'sat_pm',      label: '🏃 下午',              slotType: 'pm',      hint: '14:00-18:00', defaultMins: 40,  maxMins: 120 },
  { key: 'sat_evening', label: '📖 晚上',              slotType: 'evening', hint: '19:00-22:00', defaultMins: 45,  maxMins: 120 }
];

// 周日时段（充裕版）
const SUNDAY_SLOTS = [
  { key: 'sun_morning', label: '🌅 早晨（背单词/晨读）',slotType: 'morning', hint: '7:00-9:00',    defaultMins: 45,  maxMins: 120 },
  { key: 'sun_am',      label: '💪 上午（黄金专注时段）', slotType: 'am',      hint: '9:00-12:00',   defaultMins: 90,  maxMins: 180 },
  { key: 'sun_noon',    label: '😴 午休前后',             slotType: 'noon',     hint: '12:00-14:00',  defaultMins: 30,  maxMins: 60 },
  { key: 'sun_pm',      label: '🔥 下午（大块时间）',     slotType: 'pm',      hint: '14:00-18:00',  defaultMins: 100, maxMins: 240 },
  { key: 'sun_evening', label: '🌙 晚上（整理+预习）',    slotType: 'evening', hint: '19:00-23:00',  defaultMins: 70,  maxMins: 180 }
];

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否显示引导页
  checkLanding();

  // 默认考试日期30天后
  const d = new Date(); d.setDate(d.getDate() + 30);
  document.getElementById('examDate').value = d.toISOString().split('T')[0];

  loadFromStorage();

  // 给所有时段输入框绑定自动计算事件
  bindSlotInputs();

  if (currentPlan) {
    showCountdown(); renderPlan(currentPlan); startCountdown();
  }
});

// 绑定时段输入框，实时更新总计
function bindSlotInputs() {
  document.querySelectorAll('.slot-input').forEach(input => {
    input.addEventListener('input', updateScheduleTotals);
  });
}

// 更新所有时间段的总计显示
function updateScheduleTotals() {
  let wdTotal = 0;
  WORKDAY_SLOTS.forEach(s => {
    wdTotal += getIntVal(s.key);
  });
  document.getElementById('wdTotalMins').textContent = wdTotal;
  document.getElementById('wdTotalHours').textContent = (wdTotal / 60).toFixed(1);

  let satTotal = 0;
  SATURDAY_SLOTS.forEach(s => {
    satTotal += getIntVal(s.key);
  });
  document.getElementById('satTotalMins').textContent = satTotal;
  document.getElementById('satTotalHours').textContent = (satTotal / 60).toFixed(1);

  let sunTotal = 0;
  SUNDAY_SLOTS.forEach(s => {
    sunTotal += getIntVal(s.key);
  });
  document.getElementById('sunTotalMins').textContent = sunTotal;
  document.getElementById('sunTotalHours').textContent = (sunTotal / 60).toFixed(1);
}

function getIntVal(id) {
  return parseInt(document.getElementById(id).value) || 0;
}

// ==================== 科目管理（保持不变）====================
function addSubject(name) {
  if (name === '其他') {
    name = prompt('请输入科目名称：', '');
    if (!name || !name.trim()) return;
    name = name.trim();
  }
  if (subjects.find(s => s.name === name)) {
    showToast(`"${name}" 已经添加过了`); return;
  }
  subjects.push({ name: name, weight: 1, color: SUBJECT_COLORS[name] || getRandomColor() });
  updateSubjectUI(); saveToStorage();
  showToast(`已添加 ${name}`);
}

function removeSubject(name) {
  subjects = subjects.filter(s => s.name !== name);
  updateSubjectUI(); updateWeightSliders(); saveToStorage();
}

function updateSubjectUI() {
  const el = document.getElementById('subjectList');
  el.innerHTML = '';
  if (subjects.length === 0) {
    el.innerHTML = '<span style="color:var(--text-light);font-size:13px;">还没有选择科目</span>';
  } else {
    subjects.forEach(s => {
      const tag = document.createElement('div');
      tag.className = 'subject-tag';
      tag.style.background = `linear-gradient(135deg, ${s.color}, ${adjustColor(s.color, -20)})`;
      tag.innerHTML = `<span>${s.name}</span><button class="remove-btn" onclick="removeSubject('${s.name}')">✕</button>`;
      el.appendChild(tag);
    });
  }
  document.querySelectorAll('.preset-subjects .tag-btn').forEach(btn => {
    const bn = btn.textContent.replace('+ ', '').trim();
    if (bn !== '+ 自定义' && bn !== '其他') btn.classList.toggle('active', !!subjects.find(s => s.name === bn));
  });

  document.getElementById('weightsSection').style.display = subjects.length > 0 ? 'block' : 'none';
  document.getElementById('scheduleSection').style.display = subjects.length > 0 ? 'block' : 'none';

  if (subjects.length > 0) { updateWeightSliders(); updateScheduleTotals(); }
}

function updateWeightSliders() {
  const c = document.getElementById('weightSliders'); c.innerHTML = '';
  subjects.forEach((s, i) => {
    c.innerHTML += `
      <div class="weight-item">
        <span class="weight-label" style="color:${s.color}">${s.name}</span>
        <input type="range" min="0.5" max="3" step="0.25" value="${s.weight}"
               oninput="updateWeight(${i}, this.value)">
        <span class="weight-val">${s.weight}x</span>
      </div>`;
  });
}

function updateWeight(index, value) {
  subjects[index].weight = parseFloat(value);
  document.querySelectorAll('.weight-val')[index].textContent = value + 'x';
  saveToStorage();
}

// ==================== 🚀 核心算法：生成精确时段计划 ====================
function generatePlan() {
  const examName = document.getElementById('examName').value.trim() || '期末考试';
  const examDateStr = document.getElementById('examDate').value;

  if (!examDateStr) { showToast('⚠️ 请先选择考试日期！'); return; }
  if (subjects.length === 0) { showToast('⚠️ 请至少选择一个科目！'); return; }

  const today = new Date(); today.setHours(0,0,0,0);
  const examDate = new Date(examDateStr); examDate.setHours(23,59,59,999);
  let daysLeft = Math.ceil((examDate - today) / (1000*60*60*24));

  if (daysLeft <= 0) { showToast('⚠️ 考试日期已过！选个未来的日期'); return; }
  if (daysLeft > 365) { showToast('⚠️ 超过一年了，缩短一点吧'); return; }

  const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0);

  // ===== 收集用户设置的各时段分钟数 =====
  function getSlotMins(slotDefs) {
    return slotDefs.map(def => ({
      ...def,
      mins: getIntVal(def.key)
    })).filter(s => s.mins > 0);
  }

  const wdSlots = getSlotMins(WORKDAY_SLOTS);    // 工作日时段
  const satSlots = getSlotMins(SATURDAY_SLOTS);   // 周六
  const sunSlots = getSlotMins(SUNDAY_SLOTS);     // 周日

  // ===== 核心分配函数：有取舍地给时段分配科目 =====
  // 原则：每时段只安排 1-2 个科目，时段短只放1个，不贪多
  // prevDaySlots：前一天的 slots，用于跨天连续惩罚
  function assignTasksToSlots(slots, progressRatio, dayNum, totalDays, prevDaySlots) {
    // 记录当天已经安排过的科目（避免同一科目铺满所有时段）
    const usedToday = {};

    // 跨天连续惩罚：找出前一天"大块时段"的主场科目（am/pm/evening）
    // 只盯长时段，短时段（早读/午休/深夜）不惩罚，避免把所有科目都打压
    const prevDayMainSubjects = new Set();
    if (prevDaySlots) {
      const longSlotTypes = new Set(['am', 'pm', 'evening']);
      prevDaySlots.forEach(slot => {
        if (slot.tasks && slot.tasks.length > 0 && longSlotTypes.has(slot.slotType)) {
          prevDayMainSubjects.add(slot.tasks[0].subject);
        }
      });
    }

    return slots.map(slotDef => {
      const availableMins = slotDef.mins;
      if (availableMins < 5) return null; // 太短就跳过

      // 该时段最多放几个科目
      let maxSubjects = 1;
      if (availableMins >= 20 && availableMins < 60) maxSubjects = 2;
      if (availableMins >= 60) maxSubjects = 3; // 大块时间可以安排3个科目，更均衡

      // 按权重+时段适配度排序，选出最该在这个时段学的科目
      // 传入 dayNum 实现周期性轮换，同一时段不会永远给同一科目
      const candidates = [...subjects]
        .map(s => {
          let score = s.weight;  // 基础权重
          // 前期偏重弱项，后期均衡
          if (dayNum / totalDays < 0.35 && s.weight >= 1.5) score *= 1.25;
          else if (dayNum / totalDays < 0.35 && s.weight <= 0.75) score *= 0.75;
          // 考试前3天：全部均衡
          if (dayNum > totalDays - 3) score = 1.0;
          // 跨天连续惩罚：前一天大块时段的主场科目，今天降权
          // 数物权重本来就高，必须狠狠压，否则天天霸榜
          if (prevDayMainSubjects.has(s.name)) {
            const penalty = ['数学', '物理'].includes(s.name) ? 0.3 : 0.5;
            score *= penalty;
          }
          // 时段适配加成（含周期性轮换！）
          score *= getSlotAffinity(s.name, slotDef.slotType, dayNum);
          // 今日已用惩罚：避免同一科目占用太多时段
          if (usedToday[s.name] >= 2) score *= 0.3;
          else if (usedToday[s.name] >= 1) score *= 0.7;
          return { ...s, score };
        })
        .sort((a, b) => b.score - a.score);

      // 选前 maxSubjects 个
      const selected = candidates.slice(0, maxSubjects);
      selected.forEach(s => { usedToday[s.name] = (usedToday[s.name] || 0) + 1; });

      // 记忆类科目（溢出时间的接收方）
      const memorySubjects = ['英语', '语文', '生物', '化学', '历史', '地理', '政治'];

      // 把 availableMins 分配给选中的科目（按权重比例）
      const totalScore = selected.reduce((sum, s) => sum + s.score, 0);
      const tasks = [];
      let remaining = availableMins;

      selected.forEach((s, idx) => {
        let mins = Math.round((s.score / totalScore) * availableMins);
        // 保证每个科目至少5分钟
        mins = Math.max(5, Math.min(mins, remaining - (selected.length - idx - 1) * 5));
        mins = Math.round(mins / 5) * 5;
        if (mins >= 5) {
          tasks.push({ subject: s.name, minutes: mins, color: s.color });
          remaining -= mins;
        }
      });

      // 零头给第一个科目
      if (remaining > 0 && tasks.length > 0) {
        tasks[0].minutes += Math.round(remaining / 5) * 5;
        remaining = 0;
      }

      // ===== 单科上限80分钟：超出部分转给记忆类科目 =====
      const MAX_SINGLE = 80;
      tasks.forEach(task => {
        if (task.minutes > MAX_SINGLE) {
          const overflow = Math.round((task.minutes - MAX_SINGLE) / 5) * 5;
          task.minutes = MAX_SINGLE;
          // 找一个已存在的记忆类科目接收溢出时间
          const memTask = tasks.find(t => t !== task && memorySubjects.includes(t.subject));
          if (memTask) {
            memTask.minutes += overflow;
          } else {
            // 没有记忆类科目在当前tasks里，从subjects里找分数最高的记忆类追加
            const bestMem = candidates.find(c => memorySubjects.includes(c.name) && !tasks.find(t => t.subject === c.name));
            if (bestMem && overflow >= 5) {
              tasks.push({ subject: bestMem.subject, minutes: overflow, color: bestMem.color });
              usedToday[bestMem.name] = (usedToday[bestMem.name] || 0) + 1;
            } else if (memTask === undefined && tasks.length > 0) {
              // 实在没有，零头还给第一个科目
              tasks[0].minutes += overflow;
            }
          }
        }
      });

      if (tasks.length === 0) return null;

      return {
        slotKey: slotDef.key,
        slotLabel: slotDef.label,
        slotType: slotDef.slotType,
        slotHint: slotDef.hint,
        totalMins: availableMins,
        tasks: tasks,
        color: SLOT_COLORS[slotDef.slotType]?.border || '#999'
      };
    }).filter(Boolean);
  }

  // ===== 时段适配度（不同时段适合不同科目 + 周期性轮换）=====
  // dayNum：第几天（从1开始），用于实现轮换，避免每天同一时段都是同一科目
  function getSlotAffinity(subjectName, slotType, dayNum) {
    // 基础分组：不同时段有不同偏向，但用 dayNum 轮换，不死定
    // 轮换原理：同一组内用 dayNum % group.length 选出今天的"主场科目"
    switch (slotType) {
      case 'morning': {
        // 🌅 早读：固定2科搭配，每天换一组，不用打分竞争
        // 6天一轮，语英各出现4次，生化各出现2次，比例均衡
        const morningPairs = [
          ['语文', '英语'],   // 第1天
          ['语文', '生物'],   // 第2天
          ['英语', '化学'],   // 第3天
          ['英语', '生物'],   // 第4天
          ['语文', '化学'],   // 第5天
          ['英语', '生物'],   // 第6天
        ];
        const pair = morningPairs[dayNum % morningPairs.length];
        if (pair.includes(subjectName)) return 2.0;   // 在今天的搭配里，必选
        if (['历史','地理','政治'].includes(subjectName)) return 0.5;
        return 0.1; // 数物和其他科目几乎不出现
      }
      case 'am': {
        // ☀️ 上午课间：所有科目轮换，不偏科！
        // 9个科目分3小组，每天轮一个当主场
        const amGroup = ['数学', '物理', '化学', '生物', '英语', '语文', '历史', '地理', '政治'];
        const idx = dayNum % amGroup.length;
        if (subjectName === amGroup[idx]) return 1.4;   // 今天轮到它主场
        if (['数学', 'physics'].includes(subjectName)) return 0.9;  // 数物不加成，靠权重说话
        if (amGroup.includes(subjectName)) return 1.1;   // 同轮换组的其他科目
        return 1.0;
      }
      case 'noon': {
        // 🍱 午休前：轻量记忆类（所有记忆类轮换，数物避开）
        const noonGroup = ['生物', '化学', '历史', '地理', '政治', '英语', '语文'];
        const idx = dayNum % noonGroup.length;
        if (subjectName === noonGroup[idx]) return 1.5;
        if (noonGroup.includes(subjectName)) return 1.1;
        return 0.3; // 数物午休前绝对不做
      }
      case 'pm': {
        // 🏃 下午课间：精力下降，文科+化生为主，数物降权
        const pmGroup = ['英语', '语文', '生物', '化学', '历史', '地理', '政治'];
        const idx = dayNum % pmGroup.length;
        if (subjectName === pmGroup[idx]) return 1.4;   // 主场
        if (pmGroup.includes(subjectName)) return 1.1;   // 同组其他科目
        // 下午不适合做数理难题（精力不够 + 容易困）
        if (['数学', '物理'].includes(subjectName)) return 0.35;
        return 0.7;
      }
      case 'evening': {
        // 📖 晚自习：黄金大块时间，所有科目都行，但每天有侧重
        // 把科目分成两组轮换：理科日 vs 文科日
        const isSciDay = dayNum % 3 !== 0; // 2/3的日子偏理科
        if (isSciDay && ['数学', '物理', '化学'].includes(subjectName)) return 1.5;
        if (!isSciDay && ['语文', '英语', '历史', '地理', '政治'].includes(subjectName)) return 1.5;
        return 1.0; // 非主场科目也不低，晚自习都可以
      }
      case 'night': {
        // 🌙 深夜：固定2科搭配，每天换一组，和早读一样
        const nightPairs = [
          ['英语', '语文'],   // 第1天
          ['英语', '生物'],   // 第2天
          ['语文', '化学'],   // 第3天
          ['语文', '生物'],   // 第4天
          ['英语', '化学'],   // 第5天
          ['语文', '英语'],   // 第6天
        ];
        const pair = nightPairs[dayNum % nightPairs.length];
        if (pair.includes(subjectName)) return 2.0;
        if (['数学', 'physics'].includes(subjectName)) return 0.1;
        return 0.3;
      }
      default:
        return 1.0;
    }
  }

  // ===== 生成每一天的计划（从今天开始，含今天）=====
  const planDays = [];

  for (let d = 0; d < daysLeft; d++) {
    const dayDate = new Date(today); dayDate.setDate(dayDate.getDate() + d); // d=0 就是今天
    const dayOfWeek = dayDate.getDay(); // 0=日 1=一 ... 6=六

    let slots = [];
    let dayType = 'weekday';

    // 获取昨天的时段安排（用于跨天惩罚）
    const prevDaySlots = planDays.length > 0 ? planDays[planDays.length - 1].slots : null;

    // 根据星期几选择时段模板
    if (dayOfWeek === 0) {
      // 周日
      slots = assignTasksToSlots(sunSlots, d / daysLeft, d + 1, daysLeft, prevDaySlots);
      dayType = 'sunday';
    } else if (dayOfWeek === 6) {
      // 周六
      slots = assignTasksToSlots(satSlots, d / daysLeft, d + 1, daysLeft, prevDaySlots);
      dayType = 'saturday';
    } else {
      // 工作日（周一~周五）
      slots = assignTasksToSlots(wdSlots, d / daysLeft, d + 1, daysLeft, prevDaySlots);
      dayType = 'weekday';
    }

    planDays.push({
      date: dayDate,
      dateStr: formatDateCN(dayDate),
      dayNum: d + 1,
      totalDays: daysLeft,
      dayOfWeek: dayOfWeek,
      dayType: dayType,
      slots: slots,
      isToday: false
    });
  }

  // 计算每天总时长
  planDays.forEach(day => {
    day.totalDayMins = day.slots.reduce((sum, s) => sum + s.totalMins, 0);
  });

  // 标记今天
  const todayStr = formatDateCN(new Date());
  const tp = planDays.find(p => p.dateStr === todayStr);
  if (tp) tp.isToday = true;

  currentPlan = {
    examName: examName,
    examDate: examDate.toISOString(),
    daysLeft: daysLeft,
    subjects: [...subjects],
    days: planDays,
    scheduleConfig: {
      workday: wdSlots.map(s => ({key: s.key, label: s.label, mins: s.mins})),
      saturday: satSlots.map(s => ({key: s.key, label: s.label, mins: s.mins})),
      sunday: sunSlots.map(s => ({key: s.key, label: s.label, mins: s.mins}))
    },
    createdAt: new Date().toISOString()
  };

  saveToStorage();
  showCountdown();
  renderPlan(currentPlan);
  startCountdown();

  const totalHrs = (planDays.reduce((sum, d) => sum + d.totalDayMins, 0) / 60).toFixed(0);
  showToast(`✅ 成功生成 ${daysLeft} 天精准计划！共 ${totalHrs} 小时`);

  setTimeout(() => {
    document.getElementById('planSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 350);
}

// ==================== 渲染计划（v2 精确时段版）====================
function renderPlan(plan) {
  document.getElementById('countdownSection').style.display = 'block';
  document.getElementById('examNameDisplay').textContent = `📌 ${plan.examName}`;

  // 今日高亮
  renderTodayHighlight(plan);

  // 计划列表
  renderPlanList(plan);

  // 统计
  renderStats(plan);

  document.getElementById('planSection').style.display = 'block';
}

function renderTodayHighlight(plan) {
  const el = document.getElementById('todayTask');
  const todayDay = plan.days.find(d => d.isToday);

  if (!todayDay) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  let html = `<h3>🔥 今天是 ${todayDay.dateStr}（第 ${todayDay.dayNum}/${todayDay.totalDays} 天）</h3>`;

  todayDay.slots.forEach(slot => {
    const sc = SLOT_COLORS[slot.slotType] || {};
    const taskLi = slot.tasks.map(t =>
      `<li><span class="task-subject-name"><span class="mini-dot" style="background:${t.color}"></span>${t.subject}</span>` +
      `<span class="task-mins">${t.minutes}min</span></li>`
    ).join('');

    html += `
      <div class="today-task-slot" style="border-left-color:${sc.border || '#999'}">
        <div class="slot-header">
          <span class="slot-name"><span class="ssdot" style="background:${sc.border||'#999'}"></span>${slot.slotLabel}</span>
          <span class="slot-duration">${slot.totalMins}分钟</span>
        </div>
        <ul>${taskLi}</ul>
      </div>`;
  });

  // ===== 番茄钟计划表 =====
  // 从今天所有时段的任务中，按25分钟拆分生成番茄钟
  const todayDateKey = todayDay.dateStr; // 用日期作为 localStorage key
  const storageKey = `pomodoroStatus_${todayDateKey}`;
  let savedStatus = {};
  try { savedStatus = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}

  const tomatoes = [];
  todayDay.slots.forEach(slot => {
    slot.tasks.forEach(task => {
      let remaining = task.minutes;
      while (remaining > 0) {
        const duration = remaining >= 25 ? 25 : remaining; // 最后一节不足25分钟也算一个
        const id = `${slot.slotKey}_${task.subject}_${tomatoes.length}`;
        tomatoes.push({
          id,
          slotLabel: slot.slotLabel,
          slotType: slot.slotType,
          subject: task.subject,
          color: task.color,
          duration,
          done: !!savedStatus[id]
        });
        remaining -= duration;
      }
    });
  });

  // 过滤掉5分钟的小碎片番茄钟
  const filteredTomatoes = tomatoes.filter(t => t.duration >= 10);

  const doneCount = filteredTomatoes.filter(t => t.done).length;
  const totalCount = filteredTomatoes.length;

  if (totalCount === 0) return; // 没有够长的番茄钟就不显示整个模块

  html += `
    <div class="pomodoro-section">
      <div class="pomodoro-header">
        <span class="pomodoro-title">🍅 番茄钟计划</span>
        <span class="pomodoro-progress">${doneCount} / ${totalCount} 完成</span>
      </div>
      <div class="pomodoro-progress-bar-wrap">
        <div class="pomodoro-progress-bar" style="width:${totalCount > 0 ? Math.round(doneCount/totalCount*100) : 0}%"></div>
      </div>
      <div class="pomodoro-list">`;

  let lastSlot = null;
  filteredTomatoes.forEach((tom, idx) => {
    const sc = SLOT_COLORS[tom.slotType] || {};
    if (tom.slotLabel !== lastSlot) {
      if (lastSlot !== null) html += `</div>`; // 关闭上一个 slot 组
      html += `<div class="pomodoro-slot-group">
        <div class="pomodoro-slot-label" style="color:${sc.border||'#999'}">
          <span class="ssdot" style="background:${sc.border||'#999'}"></span>${tom.slotLabel}
        </div>`;
      lastSlot = tom.slotLabel;
    }
    const doneClass = tom.done ? ' pomo-done' : '';
    html += `
      <div class="pomodoro-item${doneClass}" id="pomo_${tom.id}" onclick="togglePomodoro('${storageKey}','${tom.id}',this)">
        <span class="pomo-check">${tom.done ? '✅' : '⬜'}</span>
        <span class="pomo-dot" style="background:${tom.color}"></span>
        <span class="pomo-subject">${tom.subject}</span>
        <span class="pomo-duration">🍅 ${tom.duration}min</span>
      </div>`;
  });
  if (lastSlot !== null) html += `</div>`; // 关闭最后一个 slot 组

  html += `</div></div>`; // 关闭 pomodoro-list 和 pomodoro-section

  el.innerHTML = html;
}

// 番茄钟勾选回调
function togglePomodoro(storageKey, id, el) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch(e) {}
  saved[id] = !saved[id];
  localStorage.setItem(storageKey, JSON.stringify(saved));

  const isDone = saved[id];
  el.classList.toggle('pomo-done', isDone);
  el.querySelector('.pomo-check').textContent = isDone ? '✅' : '⬜';

  // 更新进度数字和进度条
  const section = el.closest('.pomodoro-section');
  const allItems = section.querySelectorAll('.pomodoro-item');
  const doneCount = section.querySelectorAll('.pomodoro-item.pomo-done').length;
  const totalCount = allItems.length;
  section.querySelector('.pomodoro-progress').textContent = `${doneCount} / ${totalCount} 完成`;
  section.querySelector('.pomodoro-progress-bar').style.width =
    `${totalCount > 0 ? Math.round(doneCount/totalCount*100) : 0}%`;
}

function renderPlanList(plan) {
  const listEl = document.getElementById('planList');
  listEl.innerHTML = '';

  let daysToShow = plan.days;

  // 根据视图模式过滤
  if (currentViewMode === 'today') {
    daysToShow = plan.days.filter(d => d.isToday);
    if (daysToShow.length === 0) daysToShow = [plan.days[0]]; // 如果今天不在计划范围内，显示第一天
  } else if (currentViewMode === 'week') {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // 本周一
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    daysToShow = plan.days.filter(d => d.date >= weekStart && d.date <= weekEnd);
    if (daysToShow.length === 0) daysToShow = plan.days.slice(0, 7);
  }

  daysToShow.forEach((day, i) => {
    const dayEl = document.createElement('div');
    dayEl.className = `plan-day${day.isToday ? ' is-today' : ''}`;
    dayEl.style.animationDelay = `${i * 0.04}s`;

    const typeLabel = day.dayType === 'sunday' ? '周日 · 充裕' :
                       day.dayType === 'saturday' ? '周六' : '工作日';
    const typeClass = day.dayType !== 'weekday' ? 'weekend' : '';

    // ===== 特别注意：从昨天的番茄钟中找出未完成的 =====
    let attentionHtml = '';
    if (i > 0) { // 不是第一天才检查（第一天没有"昨天"）
      // 算出昨天的日期字符串
      const yesterdayDate = new Date(day.date);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yestStr = formatDateCN(yesterdayDate);
      const yestKey = `pomodoroStatus_${yestStr}`;
      let yestStatus = {};
      try { yestStatus = JSON.parse(localStorage.getItem(yestKey) || '{}'); } catch(e) {}

      // 从昨天的计划数据中找到对应的 day 对象，提取未完成番茄钟
      const yestDay = plan.days.find(d => d.dateStr === yestStr);
      if (yestDay) {
        const undone = [];
        yestDay.slots.forEach(slot => {
          slot.tasks.forEach(task => {
            // 模拟和 renderTodayHighlight 一样的番茄钟拆分
            let remaining = task.minutes;
            let localIdx = 0;
            while (remaining > 0) {
              const duration = remaining >= 25 ? 25 : remaining;
              const id = `${slot.slotKey}_${task.subject}_${localIdx}`;
              if (!yestStatus[id] && duration >= 10) { // 未完成且够长
                undone.push({ subject: task.subject, color: task.color, duration, slotLabel: slot.slotLabel });
              }
              remaining -= duration;
              localIdx++;
            }
          });
        });

        if (undone.length > 0) {
          // 按科目合并时长
          const merged = {};
          undone.forEach(u => {
            if (!merged[u.subject]) merged[u.subject] = { mins: 0, color: u.color };
            merged[u.subject].mins += u.duration;
          });
          const undoneLi = Object.entries(merged).map(([subj, info]) =>
            `<li><span class="tsk-subj"><span class="tsk-dot att-dot" style="background:${info.color}"></span>${subj}</span>` +
            `<span class="tsk-mins att-mins">${info.mins}min</span></li>`
          ).join('');

          attentionHtml = `
            <div class="attention-section">
              <div class="attention-header">⚠️ 特别注意 · 昨日未完成</div>
              <ul class="attention-list">${undoneLi}</ul>
            </div>`;
        }
      }
    }

    // 构建每个时间段的HTML
    const slotsHtml = day.slots.map(slot => {
      const sc = SLOT_COLORS[slot.slotType] || {};

      const tasksLi = slot.tasks.map(t =>
        `<li><span class="tsk-subj"><span class="tsk-dot" style="background:${t.color}"></span>${t.subject}</span>` +
        `<span class="tsk-mins">${t.minutes}min</span></li>`
      ).join('');

      return `
        <div class="plan-slot">
          <div class="plan-slot-info">
            <div class="plan-slot-name"><span class="ssdot" style="background:${sc.border||'#999'}"></span>${slot.slotLabel}</div>
            <ul class="plan-slot-tasks">${tasksLi}</ul>
          </div>
          <div class="plan-slot-total-time" style="background:${sc.border||'#999'}">${slot.totalMins}min</div>
        </div>`;
    }).join('');

    dayEl.innerHTML = `
      <div class="plan-day-header">
        <span class="plan-date">${day.dateStr}</span>
        <span><span class="plan-day-type ${typeClass}">${typeLabel}</span></span>
        <span class="plan-day-num">第${day.dayNum}/${day.totalDays}天 · 共${day.totalDayMins}min</span>
      </div>
      ${attentionHtml}
      ${slotsHtml}
    `;

    listEl.appendChild(dayEl);
  });
}

function renderStats(plan) {
  const bar = document.getElementById('statsBar');

  const totalMins = plan.days.reduce((sum, d) => sum + d.totalDayMins, 0);
  const avgDaily = (totalMins / plan.days.length).toFixed(0);
  const subjectCount = plan.subjects.length;

  // 找出学习最多的那一天
  const maxDay = [...plan.days].sort((a,b) => b.totalDayMins - a.totalDayMins)[0];
  const maxDayMins = maxDay?.totalDayMins || 0;

  // 平均每科每周总时长
  const weeks = Math.max(1, Math.ceil(plan.days.length / 7));
  const perSubjectWeekly = Math.round(totalMins / weeks / subjectCount);

  bar.innerHTML = `
    <div class="stat-item"><span class="stat-value">${(totalMins/60).toFixed(0)}h</span><span class="stat-label">总时长</span></div>
    <div class="stat-item"><span class="stat-value">${subjectCount}</span><span class="stat-label">科目数</span></div>
    <div class="stat-item"><span class="stat-value">${avgDaily}m</span><span class="stat-label">日均</span></div>
    <div class="stat-item"><span class="stat-value">${maxDayMins}m</span><span class="stat-label">单日最高</span></div>
  `;
}

// ==================== 视图切换 ====================
function switchPlanView(mode) {
  currentViewMode = mode;

  // 更新标签激活状态
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (mode === 'all') document.getElementById('tabAll').classList.add('active');
  else if (mode === 'week') document.getElementById('tabWeek').classList.add('active');
  else if (mode === 'today') document.getElementById('tabToday').classList.add('active');

  if (currentPlan) renderPlan(currentPlan);
}

// ==================== 倒计时（不变）====================
function showCountdown() {
  document.getElementById('countdownSection').style.display = 'block';
}
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  function update() {
    if (!currentPlan) return;
    const diff = new Date(currentPlan.examDate).getTime() - new Date().getTime();
    if (diff <= 0) {
      ['countDays','countHours','countMins'].forEach(id => document.getElementById(id).textContent = '0');
      clearInterval(countdownTimer); return;
    }
    document.getElementById('countDays').textContent = Math.floor(diff / 86400000);
    document.getElementById('countHours').textContent = Math.floor((diff % 86400000) / 3600000);
    document.getElementById('countMins').textContent = Math.floor((diff % 3600000) / 60000);
  }
  update(); countdownTimer = setInterval(update, 60000);
}

// ==================== 导出功能（升级版）====================
function exportPlan() {
  if (!currentPlan) { showToast('⚠️ 还没有生成计划哦'); return; }

  let text = `\n⚡ AI 学习规划器 v2.0 · 精准复习计划\n`;
  text += `${'═'.repeat(42)}\n`;
  text += `📌 考试名称：${currentPlan.examName}\n`;
  text += `📅 考试日期：${new Date(currentPlan.examDate).toLocaleDateString('zh-CN')}\n`;
  text += `⏰ 剩余天数：${currentPlan.daysLeft} 天\n`;
  text += `📚 复习科目：${currentPlan.subjects.map(s=>s.name).join('、')}\n\n`;

  // 今日详情
  const td = currentPlan.days.find(d => d.isToday);
  if (td) {
    text += `🔥 今日计划（${td.dateStr}）：\n`;
    td.slots.forEach(slot => {
      text += `\n  【${slot.slotLabel}】(${slot.totalMins}分钟)\n`;
      slot.tasks.forEach(t => text += `    → ${t.subject}: ${t.minutes}分钟\n`);
    });
    text += '\n';
  }

  // 完整计划（精简版）
  text += `📋 完整计划预览：\n`;
  text += `${'-'.repeat(42)}\n`;

  currentPlan.days.forEach(day => {
    text += `\n  📆 ${day.dateStr}（第${day.dayNum}天）共${day.totalDayMins}分钟\n`;
    day.slots.forEach(slot => {
      const subjStr = slot.tasks.map(t => `${t.subject}${t.minutes}m`).join(' | ');
      text += `    ${slot.slotLabel}: ${subjStr}\n`;
    }); // end slots forEach
  }); // end days forEach

  text += `\n${'═'.repeat(42)}\nMade by AI学习规划器 ⚡ | 航哥 & 皮卡丘\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('✅ 已复制到剪贴板！');
  }).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); showToast('✅ 已复制！');
  });
}

// ==================== 重置（不变）====================
function resetAll() {
  if (!confirm('确定要清空所有数据重新开始吗？')) return;
  subjects = []; currentPlan = null;
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

  updateSubjectUI();
  ['weightsSection','scheduleSection','countdownSection','planSection','todayTask'].forEach(
    id => document.getElementById(id).style.display = 'none'
  );

  document.getElementById('examName').value = '期末考试';
  const d = new Date(); d.setDate(d.getDate() + 30);
  document.getElementById('examDate').value = d.toISOString().split('T')[0];

  // 重置时段输入框为默认值
  const defaults = [...WORKDAY_SLOTS, ...SATURDAY_SLOTS, ...SUNDAY_SLOTS];
  defaults.forEach(s => {
    const el = document.getElementById(s.key);
    if (el) el.value = s.defaultMins;
  });
  updateScheduleTotals();

  localStorage.removeItem('aiStudyPlanner');
  showToast('🔄 已重置，可以重新规划了！');
}

// ==================== 存储系统（升级）====================
function saveToStorage() {
  try {
    // 同时保存时段配置
    const scheduleData = {};
    [...WORKDAY_SLOTS, ...SATURDAY_SLOTS, ...SUNDAY_SLOTS].forEach(s => {
      scheduleData[s.key] = parseInt(document.getElementById(s.key)?.value) || s.defaultMins;
    });

    localStorage.setItem('aiStudyPlanner', JSON.stringify({
      subjects: subjects,
      plan: currentPlan,
      schedule: scheduleData
    }));
  } catch(e) { console.warn('存储失败:', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('aiStudyPlanner');
    if (!raw) return;
    const data = JSON.parse(raw);

    if (data.subjects?.length > 0) {
      subjects = data.subjects;
      updateSubjectUI();
    }
    if (data.plan) currentPlan = data.plan;

    // 恢复时段配置
    if (data.schedule) {
      Object.keys(data.schedule).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = data.schedule[key];
      });
      updateScheduleTotals();
    }
  } catch(e) { console.warn('读取存储失败:', e); }
}

// ==================== 工具函数 ====================
function formatDateCN(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  const wds = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${m}月${d}日 ${wds[date.getDay()]}`;
}
function showToast(msg) {
  const existing = document.querySelector('.toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function adjustColor(hex, amount) {
  const n = parseInt(hex.slice(1),16);
  const r = Math.min(255,Math.max(0,(n>>16)+amount));
  const g = Math.min(255,Math.max(0,((n>>8)&0xFF)+amount));
  const b = Math.min(255,Math.max(0,(n&0xFF)+amount));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`;
}
function getRandomColor() {
  const c = ['#E17055','#6C5CE7','#00B894','#0984E3','#FDCB6E',
             '#D63384','#00B4D8','#55A630','#E8590C','#74B9FF'];
  return c[Math.floor(Math.random()*c.length)];
}

console.log('⚡ AI学习规划器 v2.0 精准时段版加载完成 | by 航哥 + 皮卡丘');
