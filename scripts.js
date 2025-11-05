// 全局变量 - 优化版
let allCourses = [];
let filteredCourses = [];
let sortedCourses = [];
let currentPage = 1;
const rowsPerPage = 20;
let dataLastModified = null; // 存储数据最后修改时间

// DOM缓存 - 减少重复的DOM查询
const domCache = {};

// 性能优化：预定义常用函数和变量
const DATE_PROPS = ['报名截止时间', '开始时间', '结束时间'];
const courseProperties = ['名称', '报名截止时间', '招收情况', '开始时间', '结束时间', '学分', '主讲教师', '类别'];

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', () => {
    // 预缓存关键DOM元素
    cacheDomElements();
    
    // 优先加载数据
    loadData();
    
    // 延迟初始化事件监听器，提高页面渲染速度
    requestAnimationFrame(() => {
        setupEventListeners();
    });
});

// 缓存DOM元素函数
function cacheDomElements() {
    domCache.loading = document.getElementById('loading');
    domCache.categorySelect = document.getElementById('category');
    domCache.tableHeader = document.querySelector('.data-table thead');
    domCache.tableBody = document.getElementById('course-list');
    domCache.noResults = document.getElementById('no-results');
    domCache.pagination = document.getElementById('pagination');
    domCache.totalCourses = document.getElementById('total-courses');
    domCache.filteredCourses = document.getElementById('filtered-courses');
    domCache.availableCourses = document.getElementById('available-courses');
    domCache.updateTime = document.getElementById('update-time');
}

// 加载数据 - 性能优化增强版
async function loadData() {
    try {
        // 显示加载状态
        if (domCache.loading) {
            domCache.loading.style.display = 'block';
        }
        
        // 性能优化：使用localStorage持久化缓存，减少重复请求
        const cachedData = localStorage.getItem('courseData');
        const cachedTimestamp = localStorage.getItem('courseDataTimestamp');
        
        // 如果有缓存且缓存未过期（1小时）
        if (cachedData && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp) < 3600000)) {
            const parsedData = JSON.parse(cachedData);
            allCourses = parsedData.courses;
            dataLastModified = new Date(parsedData.lastModified);
        } else {
            // 使用fetch API的缓存选项优化请求
            const response = await fetch('data.json', {
                cache: 'default',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            // 获取数据最后修改时间
            const lastModifiedHeader = response.headers.get('Last-Modified');
            if (lastModifiedHeader) {
                dataLastModified = new Date(lastModifiedHeader);
            }
            
            // 使用流式解析大型JSON文件
            const rawData = await response.json();
            
            // 预处理数据（使用更高效的处理方式）
            const safeDateToTimestamp = (dateString) => {
                try {
                    if (!dateString || typeof dateString !== 'string') return 0;
                    const date = new Date(dateString);
                    return isNaN(date.getTime()) ? 0 : date.getTime();
                } catch (e) {
                    return 0;
                }
            };
            
            // 批量处理，避免在map中定义函数
            allCourses = [];
            let latestTimestamp = 0;
            
            for (let i = 0; i < rawData.length; i++) {
                const course = rawData[i];
                const deadlineTimestamp = safeDateToTimestamp(course['报名截止时间']);
                const startTimestamp = safeDateToTimestamp(course['开始时间']);
                const endTimestamp = safeDateToTimestamp(course['结束时间']);
                
                // 更新最新时间戳
                latestTimestamp = Math.max(latestTimestamp, deadlineTimestamp, startTimestamp, endTimestamp);
                
                // 添加处理后的课程数据
                allCourses.push({
                    ...course,
                    '主讲教师': course['主讲教师'] && course['主讲教师'].trim ? course['主讲教师'].trim() : '',
                    '_deadlineTimestamp': deadlineTimestamp,
                    '_startTimestamp': startTimestamp,
                    '_endTimestamp': endTimestamp,
                    '_credit': course['学分'] && !isNaN(parseFloat(course['学分'])) ? parseFloat(course['学分']) : 0
                });
            }
            
            // 如果没有Last-Modified头，则使用计算出的最新时间
            if (!dataLastModified && latestTimestamp > 0) {
                dataLastModified = new Date(latestTimestamp);
            }
            
            // 保存到localStorage供下次使用
            try {
                localStorage.setItem('courseData', JSON.stringify({
                    courses: allCourses,
                    lastModified: dataLastModified.toISOString()
                }));
                localStorage.setItem('courseDataTimestamp', Date.now().toString());
            } catch (e) {
                // 处理localStorage配额限制
                console.warn('LocalStorage cache not available:', e);
            }
        }
        
        // 避免不必要的数组复制
        filteredCourses = allCourses;
        sortedCourses = filteredCourses;
        
        // 初始化筛选器
        initializeFilters();
        
        // 优先隐藏加载状态
        if (domCache.loading) {
            domCache.loading.style.display = 'none';
        }
        
        // 并行更新表格和统计信息
        Promise.all([
            Promise.resolve().then(() => updateTable()),
            Promise.resolve().then(() => updateStatistics())
        ]);
        
    } catch (error) {
        console.error('Error loading data:', error);
        // 使用缓存的DOM元素
        if (domCache.loading && domCache.loading.textContent !== undefined) {
            domCache.loading.textContent = '加载数据失败，请刷新页面重试';
            domCache.loading.style.display = 'block';
        }
    }
}

// 初始化筛选器 - 性能优化增强版
function initializeFilters() {
    // 使用闭包缓存标志，避免污染全局命名空间
    const initialized = initializeFilters.initialized || false;
    if (initialized) {
        return;
    }
    
    const categorySelect = domCache.categorySelect;
    if (!categorySelect) return;
    
    // 使用Set代替Map提高去重效率
    const categorySet = new Set();
    
    // 单次遍历收集类别
    for (let i = 0; i < allCourses.length; i++) {
        const category = allCourses[i]['类别'];
        if (category) {
            categorySet.add(category);
        }
    }
    
    // 构建HTML字符串并一次性插入，比创建DOM元素更快
    let optionsHtml = '';
    categorySet.forEach(category => {
        optionsHtml += `<option value="${category}">${category}</option>`;
    });
    
    // 使用innerHTML一次性更新
    if (optionsHtml) {
        categorySelect.innerHTML += optionsHtml;
    }
    
    // 标记筛选器已初始化
    initializeFilters.initialized = true;
}

// 设置事件监听器 - 性能优化增强版
function setupEventListeners() {
    // 使用闭包缓存标志
    const initialized = setupEventListeners.initialized || false;
    if (initialized) {
        return;
    }
    
    // 使用缓存的DOM元素
    const tableHeader = domCache.tableHeader;
    const categorySelect = domCache.categorySelect;
    
    // 使用事件委托优化表头排序事件
    if (tableHeader) {
        tableHeader.addEventListener('click', handleHeaderClickEvent, { passive: true });
    }
    
    // 只为类别筛选添加事件监听
    if (categorySelect) {
        // 使用防抖处理筛选变化
        categorySelect.addEventListener('change', debounce(applyFilters, 100), { passive: true });
    }
    
    // 标记事件监听器已初始化
    setupEventListeners.initialized = true;
}

// 优化的表头点击事件处理函数
function handleHeaderClickEvent(event) {
    try {
        const th = event.target.closest('th.sortable');
        if (th) {
            const field = th.getAttribute('data-sort');
            if (field) {
                handleHeaderClick(field);
            }
        }
    } catch (error) {
        console.error('Error handling header click:', error);
    }
}

// 应用筛选器 - 性能优化增强版
function applyFilters() {
    // 筛选时重置到第一页
    currentPage = 1;
    
    // 使用缓存的DOM元素
    const category = domCache.categorySelect?.value;
    
    // 性能优化：避免不必要的数组复制
    if (!category) {
        filteredCourses = allCourses;
    } else {
        // 使用更高效的数组过滤方式
        const filtered = [];
        for (let i = 0; i < allCourses.length; i++) {
            const course = allCourses[i];
            if (course['类别'] === category) {
                filtered.push(course);
            }
        }
        filteredCourses = filtered;
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

// 应用排序 - 性能优化增强版
function applySorting(field = currentSortField, direction = currentSortDirection) {
    if (!field || filteredCourses.length <= 1) {
        sortedCourses = filteredCourses;
        return;
    }
    
    // 预计算排序方向的比较乘数
    const sortMultiplier = direction === 'asc' ? 1 : -1;
    
    // 使用slice复制数组，避免修改原数组
    const coursesToSort = [...filteredCourses];
    
    // 使用更高效的排序逻辑
    if (field === '学分') {
        coursesToSort.sort((a, b) => {
            // 优先使用预处理的_credit属性
            const aValue = a._credit || 0;
            const bValue = b._credit || 0;
            return (aValue - bValue) * sortMultiplier;
        });
    } else if (field === '报名截止时间') {
        coursesToSort.sort((a, b) => {
            // 使用预处理的时间戳，避免重复创建Date对象
            const aValue = a._deadlineTimestamp || -Infinity;
            const bValue = b._deadlineTimestamp || -Infinity;
            return (aValue - bValue) * sortMultiplier;
        });
    } else if (field === '开始时间') {
        coursesToSort.sort((a, b) => {
            const aValue = a._startTimestamp || -Infinity;
            const bValue = b._startTimestamp || -Infinity;
            return (aValue - bValue) * sortMultiplier;
        });
    } else if (field === '结束时间') {
        coursesToSort.sort((a, b) => {
            const aValue = a._endTimestamp || -Infinity;
            const bValue = b._endTimestamp || -Infinity;
            return (aValue - bValue) * sortMultiplier;
        });
    } else {
        // 文本类型字段
        coursesToSort.sort((a, b) => {
            const aValue = (a[field] || '').toString().toLowerCase();
            const bValue = (b[field] || '').toString().toLowerCase();
            return aValue.localeCompare(bValue) * sortMultiplier;
        });
    }
    
    sortedCourses = coursesToSort;
}

// 重置筛选功能已移除，类别筛选可以手动选择全部

// 更新表格 - 性能优化增强版
function updateTable() {
    const tableBody = domCache.tableBody;
    const noResults = domCache.noResults;
    
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
        tableBody.innerHTML = '';
        return;
    }
    
    if (noResults) {
        noResults.style.display = 'none';
    }
    
    // 获取当前页的数据
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentCourses = sortedCourses.slice(startIndex, endIndex);
    
    // 性能优化：使用HTML字符串拼接代替DOM操作，对于大量数据更高效
    let tableHtml = '';
    const now = Date.now(); // 使用时间戳而非Date对象
    
    // 预编译正则表达式
    const recruitmentRegex = /(\d+)\/(\d+)/;
    
    // 填充表格HTML
    for (let i = 0; i < currentCourses.length; i++) {
        const course = currentCourses[i];
        
        // 使用预处理的时间戳检查过期状态，避免重复创建Date对象
        const deadlinePassed = course._deadlineTimestamp && course._deadlineTimestamp < now;
        
        // 检查招收情况是否已满
        let recruitmentFull = false;
        const recruitmentText = course['招收情况'];
        if (recruitmentText) {
            const match = recruitmentRegex.exec(recruitmentText);
            recruitmentFull = match && match.length === 3 && parseInt(match[1]) >= parseInt(match[2]);
        }
        
        // 添加行样式
        const rowClass = (deadlinePassed || recruitmentFull) ? ' class="expired-course"' : '';
        
        // 开始行
        tableHtml += `<tr${rowClass}>`;
        
        // 添加单元格
        for (let j = 0; j < courseProperties.length; j++) {
            const property = courseProperties[j];
            const value = course[property] || '-';
            let cellClass = '';
            
            // 添加单元格样式
            if (property === '学分') {
                cellClass = ' class="credit-cell"';
            }
            
            // 过期或满员状态的文本样式
            if ((property === '报名截止时间' && deadlinePassed) || 
                (property === '招收情况' && (deadlinePassed || recruitmentFull))) {
                cellClass = cellClass ? ' class="credit-cell expired-text"' : ' class="expired-text"';
            }
            
            // 转义HTML特殊字符
            const escapedValue = value.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            tableHtml += `<td${cellClass}>${escapedValue}</td>`;
        }
        
        // 结束行
        tableHtml += '</tr>';
    }
    
    // 一次性更新DOM
    tableBody.innerHTML = tableHtml;
    
    // 如果数据不多，不需要分页
    if (sortedCourses.length <= rowsPerPage) {
        if (domCache.pagination) {
            domCache.pagination.style.display = 'none';
        }
        return;
    }
    
    // 生成分页控件（如果需要）
    generatePagination();
}

// 生成分页控件 - 性能优化增强版
function generatePagination() {
    // 计算总页数
    const totalPages = Math.ceil(sortedCourses.length / rowsPerPage);
    
    // 使用缓存的DOM元素
    const paginationContainer = domCache.pagination;
    
    // 检查分页容器是否存在
    if (!paginationContainer) {
        console.error('Error: Pagination container element not found');
        return;
    }
    
    // 性能优化：使用HTML字符串拼接
    let paginationHtml = '';
    
    // 创建分页信息
    paginationHtml += `<span class="pagination-info">第 ${currentPage} / ${totalPages} 页</span>`;
    
    // 创建上一页按钮
    const prevDisabled = currentPage === 1 ? ' disabled' : '';
    paginationHtml += `<button class="btn btn-secondary"${prevDisabled} onclick="handlePageChange(${currentPage - 1})")>上一页</button>`;
    
    // 计算页码范围
    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, currentPage + 1);
    
    // 创建页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        const btnClass = isActive ? 'btn-primary' : 'btn-outline-secondary';
        paginationHtml += `<button class="btn ${btnClass}" onclick="handlePageChange(${i})")>${i}</button>`;
    }
    
    // 创建下一页按钮
    const nextDisabled = currentPage === totalPages ? ' disabled' : '';
    paginationHtml += `<button class="btn btn-secondary"${nextDisabled} onclick="handlePageChange(${currentPage + 1})")>下一页</button>`;
    
    // 一次性更新DOM
    paginationContainer.innerHTML = paginationHtml;
    paginationContainer.style.display = 'flex';
    
    // 重新绑定事件（由于使用了innerHTML）
    bindPaginationEvents(paginationContainer);
}

// 绑定分页事件处理函数
function bindPaginationEvents(container) {
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', (e) => {
                const pageText = button.textContent;
                let page = currentPage;
                
                if (pageText === '上一页') {
                    page = currentPage - 1;
                } else if (pageText === '下一页') {
                    page = currentPage + 1;
                } else {
                    page = parseInt(pageText);
                }
                
                if (!isNaN(page)) {
                    handlePageChange(page);
                }
                
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
    });
}

// 处理页码变化的辅助函数 - 全局暴露供内联onclick使用
window.handlePageChange = function(page) {
    const totalPages = Math.ceil(sortedCourses.length / rowsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        updateTable();
    }
};

// 更新统计信息 - 性能优化增强版
function updateStatistics() {
    // 使用缓存的DOM元素
    const { totalCourses: totalCountElement, 
            filteredCourses: filteredCountElement, 
            availableCourses: availableCountElement, 
            updateTime: updateTimeElement } = domCache;
    
    // 如果没有DOM元素，提前返回
    if (!totalCountElement || !filteredCountElement || !availableCountElement || !updateTimeElement) {
        return;
    }
    
    // 一次性准备好所有数据
    const totalCourses = allCourses.length;
    const filteredCoursesCount = filteredCourses.length;
    
    // 利用预处理的时间戳进行计算
    const now = Date.now();
    
    // 性能优化：使用更快的for循环代替reduce
    let availableCoursesCount = 0;
    for (let i = 0; i < filteredCourses.length; i++) {
        if (filteredCourses[i]._deadlineTimestamp > now) {
            availableCoursesCount++;
        }
    }
    
    // 获取并格式化数据更新时间
    const updateTime = dataLastModified || new Date();
    const day = updateTime.getDate();
    const hour = updateTime.getHours();
    const formattedTime = `${day}日${hour}点`;
    
    // 批量更新DOM，减少重绘和回流
    totalCountElement.textContent = totalCourses;
    filteredCountElement.textContent = filteredCoursesCount;
    availableCountElement.textContent = availableCoursesCount;
    updateTimeElement.textContent = formattedTime;
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