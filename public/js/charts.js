let performanceChartInstance = null;
let productChartInstance = null;

// Helper to format currency in charts
function formatCurrency(value) {
  return 'Rs. ' + Number(value).toLocaleString();
}

// Draw/Update Dashboard Charts
function renderDashboardCharts(monthlyPerformance, topProducts) {
  const ctxPerformance = document.getElementById('performanceChart');
  const ctxProduct = document.getElementById('productChart');

  if (!ctxPerformance || !ctxProduct) return;

  // 1. Prepare Performance Data (Sort chronologically)
  const sortedMonths = Object.keys(monthlyPerformance).sort();
  
  // Format Month keys '2026-07' to 'Jul 2026' or just short month names
  const monthLabels = sortedMonths.map(m => {
    const [yr, mn] = m.split('-');
    const date = new Date(yr, parseInt(mn, 10) - 1, 15);
    return date.toLocaleString('default', { month: 'short' }) + ' ' + yr;
  });

  const revenues = sortedMonths.map(m => monthlyPerformance[m].revenue);
  const totalCosts = sortedMonths.map(m => monthlyPerformance[m].cogs + monthlyPerformance[m].expenses + monthlyPerformance[m].adspend);
  const profits = sortedMonths.map(m => monthlyPerformance[m].netProfit);

  // Destroy previous performance chart instance
  if (performanceChartInstance) {
    performanceChartInstance.destroy();
  }

  // Draw Performance Chart (Combo Bar / Line)
  performanceChartInstance = new Chart(ctxPerformance, {
    type: 'bar',
    data: {
      labels: monthLabels.length > 0 ? monthLabels : ['No Data'],
      datasets: [
        {
          label: 'Revenue',
          data: revenues.length > 0 ? revenues : [0],
          backgroundColor: 'rgba(0, 210, 255, 0.45)',
          borderColor: '#00d2ff',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          label: 'Total Costs',
          data: totalCosts.length > 0 ? totalCosts : [0],
          backgroundColor: 'rgba(239, 68, 68, 0.3)',
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 3
        },
        {
          label: 'Net Profit',
          data: profits.length > 0 ? profits : [0],
          type: 'line',
          borderColor: '#10b981',
          borderWidth: 3,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointHoverRadius: 7,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans' }
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans' },
            callback: function(value) {
              return 'Rs.' + value.toLocaleString();
            }
          }
        }
      }
    }
  });

  // 2. Prepare Product Distribution Data
  const productLabels = topProducts.map(p => p.name);
  const productQuantities = topProducts.map(p => p.total_qty);

  // Destroy previous product chart instance
  if (productChartInstance) {
    productChartInstance.destroy();
  }

  // Draw Product Doughnut Chart
  productChartInstance = new Chart(ctxProduct, {
    type: 'doughnut',
    data: {
      labels: productLabels.length > 0 ? productLabels : ['No Sales'],
      datasets: [{
        data: productQuantities.length > 0 ? productQuantities : [1],
        backgroundColor: [
          '#00d2ff',
          '#0066ff',
          '#a371f7',
          '#10b981',
          '#f59e0b',
          '#ef4444'
        ],
        borderColor: '#0b0f1d',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            padding: 16,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              if (context.label === 'No Sales') return ' No sales recorded';
              return ` ${context.label}: ${context.raw} unit(s)`;
            }
          }
        }
      }
    }
  });
}
