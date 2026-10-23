"use strict";

// Display-only projection. Storage and record validation remain in their existing modules.
function measured(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));
}
function measurementText(value) { return measured(value) ? Number(value).toFixed(1) : '未记录'; }
function dayNumber(value) {
  const parts = String(value || '').split('-').map(Number);
  return parts.length === 3 ? Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000 : NaN;
}
function buildCharts(records) {
  const chronological = records.filter(row => Number.isFinite(dayNumber(row.date)))
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const firstDay = chronological.length ? dayNumber(chronological[0].date) : 0;
  const lastDay = chronological.length ? dayNumber(chronological[chronological.length - 1].date) : 0;
  // rpx geometry matches the approved 390-wide screen; both plots use one time domain.
  const width = 546, height = 212;
  const xFor = row => lastDay === firstDay ? width / 2 : (dayNumber(row.date) - firstDay) / (lastDay - firstDay) * width;
  const dates = [];
  chronological.forEach((row, index) => {
    const x = xFor(row);
    const isLast = index === chronological.length - 1;
    if (index === 0 || isLast || (x - dates[dates.length - 1].x >= 130 && width - x >= 130)) {
      if (isLast && dates.length > 1 && x - dates[dates.length - 1].x < 100) dates.pop();
      dates.push({ date:row.date, label:row.date.slice(5).replace('-', '/'), x, style:`left:${x}rpx;` });
    }
  });
  dates.forEach((date, index) => {
    const offset = dates.length === 1 ? -50 : index === 0 ? 0 : index === dates.length - 1 ? -100 : -50;
    date.style += `transform:translateX(${offset}%);`;
  });
  return [
    { key:'height', title:'身高', unit:'cm', color:'#3178bc', pad:3 },
    { key:'weight', title:'体重', unit:'kg', color:'#58733d', pad:0.5 }
  ].map(metric => {
    const rows = chronological.filter(row => measured(row[metric.key]));
    const values = rows.map(row => Number(row[metric.key]));
    const minimum = values.length ? Math.floor((Math.min(...values) - metric.pad) * 10) / 10 : 0;
    const maximum = values.length ? Math.ceil((Math.max(...values) + metric.pad) * 10) / 10 : 1;
    const ticks = [maximum, (maximum + minimum) / 2, minimum].map((value, index) => ({
      isBaseline:index === 2,
      label:metric.key === 'height' ? String(Number(value.toFixed(1))) : value.toFixed(1),
      style:`top:${index * height / 2}rpx;`
    }));
    const points = rows.map((row, index) => {
      const x = xFor(row), y = height - (Number(row[metric.key]) - minimum) / (maximum - minimum) * height;
      return { id:row.id, date:row.date, value:Number(row[metric.key]), x, y,
        style:`left:${x}rpx;top:${y}rpx;`,
        label:measurementText(row[metric.key]), showLabel:index === rows.length - 1,
        labelClass:x > width - 70 ? 'align-end' : x < 70 ? 'align-start' : '' };
    });
    const segments = points.slice(1).map((point, index) => {
      const start = points[index], dx = point.x - start.x, dy = point.y - start.y;
      return { id:point.id, style:`left:${start.x}rpx;top:${start.y}rpx;width:${Math.hypot(dx, dy)}rpx;transform:rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg);` };
    });
    return { ...metric, ticks, points, segments, dates, firstDate:chronological[0]?.date || '', lastDate:chronological[chronological.length - 1]?.date || '',
      hint:points.length < 2 ? '再记录一次，即可查看变化' : '每个圆点，都是一次真实测量',
      ariaLabel:`${metric.title}，单位${metric.unit}，${points.length}条测量记录；完整数值见下方成长记录。` };
  });
}
module.exports = { measured, measurementText, buildCharts };
