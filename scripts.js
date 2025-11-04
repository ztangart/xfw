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

// 加载数据 - 性能优化版本
async function loadData() {
    try {
        // 显示加载状态
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        
        // 性能优化：使用缓存机制避免重复请求
        if (window.cachedCourseData) {
            allCourses = window.cachedCourseData;
        } else {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            // 直接处理原始数据，避免额外的数组复制
            const rawData = await response.json();
            
            // 预处理数据并缓存结果
            allCourses = rawData.map(course => {
                // 安全的日期转换函数
                const safeDateToTimestamp = (dateString) => {
                    try {
                        if (!dateString || typeof dateString !== 'string') return 0;
                        const date = new Date(dateString);
                        return isNaN(date.getTime()) ? 0 : date.getTime();
                    } catch (e) {
                        return 0;
                    }
                };
                
                return {
                    ...course,
                    '主讲教师': course['主讲教师'] && course['主讲教师'].trim ? course['主讲教师'].trim() : '',
                    // 安全转换日期为时间戳
                    '_deadlineTimestamp': safeDateToTimestamp(course['报名截止时间']),
                    '_startTimestamp': safeDateToTimestamp(course['开始时间']),
                    '_endTimestamp': safeDateToTimestamp(course['结束时间']),
                    '_credit': course['学分'] && !isNaN(parseFloat(course['学分'])) ? parseFloat(course['学分']) : 0
                };
            });
            
            // 缓存处理后的数据
            window.cachedCourseData = allCourses;
        }
        
        // 避免不必要的数组复制
        filteredCourses = [...allCourses];
        sortedCourses = [...filteredCourses];
        
        // 初始化组件
        initializeFilters();
        
        // 优先隐藏加载状态
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // 异步更新表格和统计信息，不阻塞UI
        setTimeout(() => {
            updateTable();
            updateStatistics();
        }, 0);
        
    } catch (error) {
        console.error('Error loading data:', error);
        // 安全地更新加载状态元素
        const loadingElement = document.getElementById('loading');
        if (loadingElement && loadingElement.textContent !== undefined) {
            loadingElement.textContent = '加载数据失败，请刷新页面重试';
            loadingElement.style.display = 'block';
        }
    }
}

// 初始化筛选器 - 简化版本（只保留类别筛选）
function initializeFilters() {
    // 缓存检查，避免重复初始化
    if (window.filtersInitialized) {
        return;
    }
    
    const categorySelect = document.getElementById('category');
    
    // 收集所有唯一的类别
    const categories = [];
    const categoryMap = new Map();
    
    // 单次遍历收集类别
    allCourses.forEach(course => {
        const category = course['类别'];
        if (category && !categoryMap.has(category)) {
            categoryMap.set(category, true);
            categories.push(category);
        }
    });
    
    // 使用文档片段减少DOM操作
    if (categorySelect) {
        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            fragment.appendChild(option);
        });
        categorySelect.appendChild(fragment);
    }
    
    // 标记筛选器已初始化
    window.filtersInitialized = true;
}

// 设置事件监听器 - 简化版本
function setupEventListeners() {
    // 缓存检查，避免重复设置事件监听器
    if (window.eventListenersInitialized) {
        return;
    }
    
    // 获取必要的DOM元素
    const tableHeader = document.querySelector('.data-table thead');
    const categorySelect = document.getElementById('category');
    
    // 使用事件委托优化表头排序事件
    if (tableHeader && tableHeader.addEventListener) {
        tableHeader.addEventListener('click', (event) => {
            try {
                const th = event.target.closest('th.sortable');
                if (th && th.getAttribute) {
                    const field = th.getAttribute('data-sort');
                    handleHeaderClick(field);
                }
            } catch (error) {
                console.error('Error handling header click:', error);
            }
        });
    }
    
    // 只为类别筛选添加事件监听
    if (categorySelect) {
        categorySelect.addEventListener('change', applyFilters);
    }
    
    // 标记事件监听器已初始化
    window.eventListenersInitialized = true;
}

// 应用筛选器 - 简化版本（只保留类别筛选）
function applyFilters() {
    // 筛选时重置到第一页
    currentPage = 1;
    
    // 只获取类别筛选值
    const category = document.getElementById('category').value;
    
    // 性能优化：当筛选条件为空时，直接使用全部数据
    if (!category) {
        filteredCourses = [...allCourses];
    } else {
        // 简化的筛选逻辑，只保留类别筛选
        filteredCourses = allCourses.filter(course => {
            // 类别筛选
            return !category || course['类别'] === category;
        });
    }
    
    // 应用排序
    applySorting();
    
    // 异步更新表格和统计信息，避免阻塞UI
    requestAnimationFrame(() => {
        updateTable();
        updateStatistics();
    });
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
        // 否则设置为新的排序字段
        currentSortField = field;
        // 对于报名截止时间，默认排序方向为降序（从大到小），其他字段默认为升序
        currentSortDirection = field === '报名截止时间' ? 'desc' : 'asc';
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

// 应用排序 - 性能优化版本
function applySorting(field = currentSortField, direction = currentSortDirection) {
    if (!field) {
        sortedCourses = [...filteredCourses];
        return;
    }
    
    // 预计算排序方向的比较乘数，避免在排序回调中重复判断
    const sortMultiplier = direction === 'asc' ? 1 : -1;
    
    // 使用更高效的排序逻辑，根据字段类型选择不同的排序函数
    if (field === '学分') {
        sortedCourses = [...filteredCourses].sort((a, b) => {
            // 预先解析数字，避免在排序比较中重复解析
            const aValue = parseFloat(a['学分']) || 0;
            const bValue = parseFloat(b['学分']) || 0;
            return (aValue - bValue) * sortMultiplier;
        });
    } else if (field === '报名截止时间' || field === '开始时间' || field === '结束时间') {
        sortedCourses = [...filteredCourses].sort((a, b) => {
            // 日期类型字段
            const aValue = a[field] ? new Date(a[field]).getTime() : -Infinity;
            const bValue = b[field] ? new Date(b[field]).getTime() : -Infinity;
            return (aValue - bValue) * sortMultiplier;
        });
    } else {
        // 文本类型字段
        sortedCourses = [...filteredCourses].sort((a, b) => {
            const aValue = (a[field] || '').toString().toLowerCase();
            const bValue = (b[field] || '').toString().toLowerCase();
            return aValue.localeCompare(bValue) * sortMultiplier;
        });
    }
}

// 重置筛选功能已移除，类别筛选可以手动选择全部

// 更新表格 - 性能优化版本
function updateTable() {
    const tableBody = document.getElementById('course-list');
    const noResults = document.getElementById('no-results');
    
    // 检查必要的DOM元素是否存在
    if (!tableBody) {
        console.error('Error: Table body element not found');
        return;
    }
    
    if (sortedCourses.length === 0) {
        if (noResults) {
            noResults.style.display = 'block';
        }
        // 使用更快的清空方法
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }
        return;
    }
    
    if (noResults) {
        noResults.style.display = 'none';
    }
    
    // 获取当前页的数据
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentCourses = sortedCourses.slice(startIndex, endIndex);
    
    // 使用文档片段减少DOM操作次数
    const fragment = document.createDocumentFragment();
    
    // 课程属性（提取为常量，避免重复创建数组）
    const properties = [
        '类别', '主讲教师', '名称', '报名截止时间', '学分',
        '招收情况', '开始时间', '结束时间'
    ];
    
    // 获取当前时间（只计算一次，避免在循环中重复创建）
    const now = new Date();
    
    // 填充表格
    currentCourses.forEach(course => {
        const row = document.createElement('tr');
        
        // 检查截止时间是否已过期
        const deadlinePassed = course['报名截止时间'] ? new Date(course['报名截止时间']) < now : false;
        
        // 检查招收情况是否已满（优化正则匹配逻辑）
        let recruitmentFull = false;
        const recruitmentText = course['招收情况'];
        if (recruitmentText) {
            const match = recruitmentText.match(/(\d+)\/(\d+)/);
            recruitmentFull = match && match.length === 3 && parseInt(match[1]) >= parseInt(match[2]);
        }
        
        // 应用行样式（如果需要）
        if (deadlinePassed || recruitmentFull) {
            row.classList.add('expired-course');
        }
        
        // 创建单元格
        properties.forEach(property => {
            const cell = document.createElement('td');
            cell.textContent = course[property] || '-';
            
            // 应用单元格样式
            if (property === '学分') {
                cell.classList.add('credit-cell'); // 使用CSS类代替内联样式
            }
            
            // 过期或满员状态的文本样式
            if ((property === '报名截止时间' && deadlinePassed) || 
                (property === '招收情况' && (deadlinePassed || recruitmentFull))) {
                cell.classList.add('expired-text'); // 使用CSS类代替内联样式
            }
            
            row.appendChild(cell);
        });
        
        fragment.appendChild(row);
    });
    
    // 清空表格并一次性添加所有行
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }
    tableBody.appendChild(fragment);
    
    // 如果数据不多，不需要分页
    if (sortedCourses.length <= rowsPerPage) {
        return;
    }
    
    // 生成分页控件（如果需要）
    generatePagination();
}

// 生成分页控件 - 性能优化版本
function generatePagination() {
    // 计算总页数
    const totalPages = Math.ceil(sortedCourses.length / rowsPerPage);
    
    // 获取分页容器
    const paginationContainer = document.getElementById('pagination');
    
    // 检查分页容器是否存在
    if (!paginationContainer) {
        console.error('Error: Pagination container element not found');
        return;
    }
    
    // 使用文档片段减少DOM操作
    const fragment = document.createDocumentFragment();
    
    // 创建分页信息
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    pageInfo.className = 'pagination-info';
    fragment.appendChild(pageInfo);
    
    // 创建上一页按钮
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.className = 'btn btn-secondary';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', handlePageChange.bind(null, currentPage - 1));
    fragment.appendChild(prevButton);
    
    // 计算页码范围
    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, currentPage + 1);
    
    // 创建页码按钮（复用事件处理器）
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-outline-secondary'}`;
        pageButton.addEventListener('click', handlePageChange.bind(null, i));
        fragment.appendChild(pageButton);
    }
    
    // 创建下一页按钮
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.className = 'btn btn-secondary';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', handlePageChange.bind(null, currentPage + 1));
    fragment.appendChild(nextButton);
    
    // 清空容器并一次性添加所有元素
    while (paginationContainer.firstChild) {
        paginationContainer.removeChild(paginationContainer.firstChild);
    }
    paginationContainer.appendChild(fragment);
}

// 处理页码变化的辅助函数
function handlePageChange(page) {
    if (page >= 1 && page <= Math.ceil(sortedCourses.length / rowsPerPage)) {
        currentPage = page;
        updateTable();
    }
    
    // 确保分页容器可见 - 直接获取元素避免全局变量依赖
    const paginationContainer = document.getElementById('pagination');
    if (paginationContainer) {
        paginationContainer.style.display = 'block';
    }
}

// 更新统计信息 - 性能优化版本
function updateStatistics() {
    // 一次性准备好所有数据，减少DOM操作
    const totalCourses = allCourses.length;
    const filteredCoursesCount = filteredCourses.length;
    
    // 利用预处理的时间戳进行计算，避免重复的日期转换
    const now = Date.now();
    
    // 性能优化：使用预计算的时间戳进行快速筛选
    const availableCoursesCount = filteredCourses.reduce((count, course) => {
        // 使用预处理的时间戳，避免重复创建Date对象
        return (course._deadlineTimestamp > now) ? count + 1 : count;
    }, 0);
    
    // 获取并格式化当前时间为'日数小时'格式
    const currentTime = new Date();
    const day = currentTime.getDate();
    const hour = currentTime.getHours();
    const formattedTime = `${day}日${hour}点`;
    
    // 批量更新DOM，减少重绘和回流
    // 使用HTML中实际存在的DOM元素ID
    const totalCountElement = document.getElementById('total-courses');
    const filteredCountElement = document.getElementById('filtered-courses');
    const availableCountElement = document.getElementById('available-courses');
    const updateTimeElement = document.getElementById('update-time');
    
    if (totalCountElement) totalCountElement.textContent = totalCourses;
    if (filteredCountElement) filteredCountElement.textContent = filteredCoursesCount;
    if (availableCountElement) availableCountElement.textContent = availableCoursesCount;
    if (updateTimeElement) updateTimeElement.textContent = formattedTime;
}

// 图表功能已移除

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