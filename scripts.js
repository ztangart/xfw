// 全局变量
let allCourses = [];
let filteredCourses = [];
let sortedCourses = [];
let currentPage = 1;
const rowsPerPage = 20;
let categoryChart = null;

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

// 加载数据
async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        allCourses = await response.json();
        
        // 清理教师姓名中的多余空格
        allCourses = allCourses.map(course => ({
            ...course,
            '主讲教师': course['主讲教师'].trim()
        }));
        
        filteredCourses = [...allCourses];
        sortedCourses = [...filteredCourses];
        initializeFilters();
        updateTable();
        updateStatistics();
        
        // 隐藏加载状态
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').textContent = '加载数据失败，请刷新页面重试';
    }
}

// 初始化筛选器
function initializeFilters() {
    // 获取所有唯一的类别
    const categories = [...new Set(allCourses.map(course => course['类别']))];
    const categorySelect = document.getElementById('category');
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// 设置事件监听器
function setupEventListeners() {
    document.getElementById('reset-btn').addEventListener('click', resetFilters);
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // 添加表头排序事件
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            handleHeaderClick(field);
        });
    });
    
    // 添加实时筛选功能
    const filterInputs = document.querySelectorAll('.filter-input');
    filterInputs.forEach(input => {
        input.addEventListener('input', debounce(applyFilters, 300));
    });
    
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', applyFilters);
    });
}

// 应用筛选器
function applyFilters() {
    const category = document.getElementById('category').value;
    const teacher = document.getElementById('teacher').value.toLowerCase();
    const courseName = document.getElementById('course-name').value.toLowerCase();
    
    filteredCourses = allCourses.filter(course => {
        // 类别筛选
        if (category && course['类别'] !== category) {
            return false;
        }
        
        // 教师筛选
        if (teacher && !course['主讲教师'].toLowerCase().includes(teacher)) {
            return false;
        }
        
        // 课程名称筛选
        if (courseName && !course['名称'].toLowerCase().includes(courseName)) {
            return false;
        }
        
        return true;
    });
    
    // 应用排序
    applySorting();
    
    // 更新表格和统计信息
    currentPage = 1;
    updateTable();
    updateStatistics();
}

// 处理表头点击排序
function handleHeaderClick(field) {
    // 移除所有表头的排序样式
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // 确定排序方向
    if (currentSortField === field) {
        // 如果点击的是当前排序字段，切换排序方向
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // 否则设置为新的排序字段，并默认为升序
        currentSortField = field;
        currentSortDirection = 'asc';
    }
    
    // 应用新的排序样式
    const header = document.querySelector(`th[data-sort="${field}"]`);
    if (header) {
        header.classList.add(`sort-${currentSortDirection}`);
    }
    
    // 应用排序
    applySorting(field, currentSortDirection);
    updateTable();
}

// 当前排序状态
let currentSortField = null;
let currentSortDirection = 'asc';

// 应用排序
function applySorting(field = currentSortField, direction = currentSortDirection) {
    if (!field) {
        sortedCourses = [...filteredCourses];
    } else {
        sortedCourses = [...filteredCourses].sort((a, b) => {
            let aValue, bValue;
            
            switch (field) {
                case 'credits':
                    aValue = parseFloat(a['学分']) || 0;
                    bValue = parseFloat(b['学分']) || 0;
                    break;
                case 'deadline':
                    aValue = new Date(a['报名截止时间']);
                    bValue = new Date(b['报名截止时间']);
                    break;
                case 'start':
                    aValue = new Date(a['开始时间']);
                    bValue = new Date(b['开始时间']);
                    break;
                case 'end':
                    aValue = new Date(a['结束时间']);
                    bValue = new Date(b['结束时间']);
                    break;
                default:
                    return 0;
            }
            
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
}

// 重置筛选器
function resetFilters() {
    document.getElementById('category').value = '';
    document.getElementById('teacher').value = '';
    document.getElementById('course-name').value = '';
    
    // 重置排序状态
    currentSortField = null;
    currentSortDirection = 'asc';
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    filteredCourses = [...allCourses];
    currentPage = 1;
    applySorting(); // 应用默认排序
    updateTable();
    updateStatistics();
}

// 更新表格
function updateTable() {
    const tableBody = document.getElementById('course-list');
    const noResults = document.getElementById('no-results');
    
    // 清空表格
    tableBody.innerHTML = '';
    
    if (sortedCourses.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    
    noResults.style.display = 'none';
    
    // 获取当前页的数据
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentCourses = sortedCourses.slice(startIndex, endIndex);
    
    // 填充表格
        currentCourses.forEach(course => {
            const row = document.createElement('tr');
            
            // 课程属性
            const properties = [
                '类别', '主讲教师', '名称', '学分', '报名截止时间',
                '招收情况', '开始时间', '结束时间'
            ];
            
            // 获取当前时间用于比对截止时间
            const now = new Date();
            
            // 检查截止时间是否已过期
            const deadlinePassed = course['报名截止时间'] ? new Date(course['报名截止时间']) < now : false;
            
            // 检查招收情况是否已满
            let recruitmentFull = false;
            if (course['招收情况']) {
                // 尝试从招收情况字符串中提取当前人数和最大人数
                const match = course['招收情况'].match(/(\d+)\/(\d+)/);
                if (match && match.length === 3) {
                    const current = parseInt(match[1]);
                    const max = parseInt(match[2]);
                    recruitmentFull = current >= max;
                }
            }
            
            properties.forEach(property => {
                const cell = document.createElement('td');
                cell.textContent = course[property] || '-';
                
                // 添加一些样式优化
                if (property === '学分') {
                    cell.style.fontWeight = '600';
                    cell.style.color = '#667eea';
                }
                
                if (property === '申请状态') {
                    const status = course[property];
                    if (status === '未申请') {
                        cell.style.color = '#ed8936';
                    } else if (status === '已申请') {
                        cell.style.color = '#3182ce';
                    } else if (status === '已通过') {
                        cell.style.color = '#38a169';
                    }
                }
                
                // 如果截止时间已过期或招收已满，将文本设置为灰色
                if ((property === '报名截止时间' && deadlinePassed) || 
                    (property === '招收情况' && (deadlinePassed || recruitmentFull))) {
                    cell.style.color = '#94a3b8';
                    cell.style.fontStyle = 'italic';
                }
                
                row.appendChild(cell);
            });
            
            // 如果课程已过期或招收已满，给整行添加提示性样式
            if (deadlinePassed || recruitmentFull) {
                row.classList.add('expired-course');
            }
            
            tableBody.appendChild(row);
        });
    
    // 如果数据不多，不需要分页
    if (filteredCourses.length <= rowsPerPage) {
        return;
    }
    
    // 生成分页控件（如果需要）
    generatePagination();
}

// 生成分页控件
function generatePagination() {
    // 简化版：只在需要时实现完整分页
    // 目前数据量不大，可以先不实现复杂的分页
}

// 更新统计信息
function updateStatistics() {
    // 计算统计数据
    const totalCourses = allCourses.length;
    const filteredCoursesCount = filteredCourses.length;
    
    // 计算可报名课程数（假设截止时间晚于当前时间的课程为可报名课程）
    const now = new Date();
    const availableCoursesCount = filteredCourses.filter(course => {
        const deadline = new Date(course['报名截止时间']);
        return deadline > now;
    }).length;
    
    // 计算课程类别数
    const categories = new Set(allCourses.map(course => course['课程类别']));
    const totalCategoriesCount = categories.size;
    
    // 更新DOM - 使用新的统计元素类名
    document.getElementById('total-courses').textContent = totalCourses;
    document.getElementById('filtered-courses').textContent = filteredCoursesCount;
    document.getElementById('available-courses').textContent = availableCoursesCount;
    document.getElementById('total-categories').textContent = totalCategoriesCount;
}

// 图表功能已移除

// 导出数据
function exportData() {
    // 创建CSV内容
    const headers = ['类别', '主讲教师', '名称', '学分', '报名截止时间', '招收情况', '开始时间', '结束时间', '申请状态', '作业上传', '赋予学分'];
    let csvContent = headers.join(',') + '\n';
    
    filteredCourses.forEach(course => {
        const row = headers.map(header => {
            const value = course[header] || '';
            // 处理包含逗号的字段
            return `"${value}"`;
        });
        csvContent += row.join(',') + '\n';
    });
    
    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `拓展教育课程数据_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 添加一些额外的辅助功能
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}