// 全局变量
let dp;
let channels = [];
let currentChannel = null;
let currentSourceIndex = 0;
let channelGroups = {};
const DEFAULT_CHANNEL_URL = 'default.m3u';

// DOM加载完成后执行
$(document).ready(function() {
    console.log('DOM加载完成，开始初始化');
    
    // 检查是否通过HTTP服务器访问
    if (window.location.protocol === 'file:') {
        alert('请通过HTTP服务器访问此网页，而不是直接从文件系统打开。\n\n请在浏览器中输入: http://localhost:8080');
        return;
    }
    
    // 初始化播放器
    initPlayer();
    
    // 绑定事件
    bindEvents();
    
    // 加载默认节目列表
    console.log('调用loadDefaultChannels函数');
    loadDefaultChannels();
    
    // 初始化并更新当前时间
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
});

// 初始化Dplayer播放器
function initPlayer() {
    dp = new DPlayer({
        container: document.getElementById('dplayer'),
        autoplay: true,
        volume: 0.7,
        mutex: true,
        video: {
            url: '',
            type: 'hls'
        }
    });
}

// 绑定事件
function bindEvents() {
    // 导入m3u8文件
    $('#import-btn').click(function() {
        $('#m3u8-file').click();
    });
    
    // 文件选择事件
    $('#m3u8-file').change(function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                parseM3U8(e.target.result);
            };
            reader.readAsText(file);
        }
    });
    
    // 播放m3u8链接
    $('#play-url-btn').click(function() {
        $('#url-modal').css('display', 'block');
    });
    
    // 关闭模态框
    $('.close').click(function() {
        $('#url-modal').css('display', 'none');
    });
    
    // 点击模态框外部关闭
    $(window).click(function(e) {
        if (e.target.id === 'url-modal') {
            $('#url-modal').css('display', 'none');
        }
    });
    
    // 确认播放链接
    $('#confirm-url').click(function() {
        const url = $('#m3u8-url').val().trim();
        if (url) {
            playUrl(url);
            $('#url-modal').css('display', 'none');
        }
    });
    
    // 换源按钮
    $('#change-source-btn').click(function() {
        showSourceModal();
    });
    
    // 关闭换源弹窗
    $('#source-modal .close').click(function() {
        $('#source-modal').css('display', 'none');
    });
    
    // 点击换源弹窗外部关闭
    $(window).click(function(e) {
        if (e.target.id === 'source-modal') {
            $('#source-modal').css('display', 'none');
        }
    });
    
    // 取消换源
    $('#cancel-source').click(function() {
        $('#source-modal').css('display', 'none');
    });
    
    // 恢复默认列表
    $('#restore-default-btn').click(function() {
        loadDefaultChannels();
    });
}

// 解析m3u8文件
function parseM3U8(content) {
    console.log('=== 开始解析M3U8文件 ===');
    console.log('文件内容长度:', content.length);
    
    const lines = content.split('\n');
    console.log('文件行数:', lines.length);
    
    let currentGroup = '未分组';
    let currentChannel = null;
    let channelCount = 0;
    
    channels = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 解析分组信息
        if (line.startsWith('#EXTGRP:')) {
            currentGroup = line.substring(8);
            console.log('解析到分组:', currentGroup);
        }
        // 解析频道信息
        else if (line.startsWith('#EXTINF:')) {
            const info = line.substring(8);
            const durationMatch = info.match(/^([\d.]+)/);
            const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;
            const nameMatch = info.match(/,(.*)$/);
            const name = nameMatch ? nameMatch[1] : '未知频道';
            
            currentChannel = {
                name: name,
                group: currentGroup,
                sources: [],
                duration: duration
            };
            console.log('解析到频道:', name, '分组:', currentGroup);
        }
        // 解析频道链接
        else if (line && !line.startsWith('#')) {
            if (currentChannel) {
                currentChannel.sources.push(line);
                channels.push(currentChannel);
                channelCount++;
                console.log('解析到频道链接:', line, '频道数量:', channelCount);
                currentChannel = null;
            }
        }
    }
    
    console.log('解析完成，原始频道数量:', channelCount);
    
    // 合并相同频道
    mergeSameChannels();
    console.log('合并后频道数量:', channels.length);
    
    // 按分组组织频道
    organizeChannelsByGroup();
    console.log('分组数量:', Object.keys(channelGroups).length);
    
    // 渲染频道列表
    renderChannelList();
    console.log('=== M3U8文件解析完成 ===');
}

// 合并相同频道
function mergeSameChannels() {
    const mergedChannels = {};
    
    channels.forEach(channel => {
        if (!mergedChannels[channel.name]) {
            mergedChannels[channel.name] = {
                name: channel.name,
                group: channel.group,
                sources: [...channel.sources],
                duration: channel.duration
            };
        } else {
            // 合并相同频道的不同源
            mergedChannels[channel.name].sources = [...mergedChannels[channel.name].sources, ...channel.sources];
        }
    });
    
    channels = Object.values(mergedChannels);
}

// 按分组组织频道
function organizeChannelsByGroup() {
    channelGroups = {};
    
    channels.forEach(channel => {
        if (!channelGroups[channel.group]) {
            channelGroups[channel.group] = [];
        }
        channelGroups[channel.group].push(channel);
    });
}

// 渲染频道列表
function renderChannelList() {
    const channelGroupsEl = $('#channel-groups');
    channelGroupsEl.empty();
    
    // 遍历每个分组
    Object.keys(channelGroups).forEach(groupName => {
        const groupChannels = channelGroups[groupName];
        
        // 创建分组元素
        const groupEl = $('<div class="channel-group"></div>');
        const groupTitle = $('<h4></h4>').text(groupName);
        groupEl.append(groupTitle);
        
        // 创建频道列表
        const channelList = $('<div class="channel-items"></div>');
        
        // 遍历每个频道
        groupChannels.forEach(channel => {
            const channelItem = $('<div class="channel-item"></div>');
            const channelName = $('<span class="channel-name"></span>').text(channel.name);
            const deleteBtn = $('<button class="delete-btn" title="删除频道"><i class="fas fa-trash"></i></button>');
            
            // 绑定删除按钮事件
            deleteBtn.click(function(e) {
                e.stopPropagation(); // 阻止事件冒泡
                if (confirm(`确定要删除频道 "${channel.name}" 吗？`)) {
                    deleteChannel(channel.name);
                }
            });
            
            // 绑定频道点击事件
            channelItem.click(function() {
                // 移除其他频道的激活状态
                $('.channel-item').removeClass('active');
                // 添加当前频道的激活状态
                $(this).addClass('active');
                
                // 播放当前频道
                playChannel(channel);
            });
            
            channelItem.append(channelName);
            channelItem.append(deleteBtn);
            channelList.append(channelItem);
        });
        
        groupEl.append(channelList);
        channelGroupsEl.append(groupEl);
    });
}

// 播放频道
function playChannel(channel) {
    currentChannel = channel;
    currentSourceIndex = 0;
    
    if (channel.sources.length > 0) {
        const source = channel.sources[currentSourceIndex];
        playSource(source, channel.name);
    }
}

// 播放指定源
function playSource(source, title) {
    dp.switchVideo({
        url: source,
        type: 'hls',
        title: title
    });
}

// 播放m3u8链接
function playUrl(url) {
    // 检查链接是否为m3u8列表
    if (url.includes('.m3u8') || url.includes('.m3u')) {
        // 尝试获取并解析链接内容
        axios.get(url)
            .then(response => {
                // 检查内容是否为m3u8格式
                if (response.data.includes('#EXTM3U')) {
                    // 是列表，覆盖当前列表
                    parseM3U8(response.data);
                    alert('已加载并覆盖为新的节目列表');
                } else {
                    // 是单个节目，添加到列表末尾
                    addSingleChannel(url);
                }
            })
            .catch(error => {
                // 获取失败，视为单个节目
                addSingleChannel(url);
            });
    } else {
        // 不是m3u8链接，视为单个节目
        addSingleChannel(url);
    }
}

// 添加单个频道到列表末尾
function addSingleChannel(url) {
    const newChannel = {
        name: '自定义频道',
        group: '自定义',
        sources: [url],
        duration: 0
    };
    
    // 添加到频道列表
    channels.push(newChannel);
    
    // 重新按分组组织频道
    organizeChannelsByGroup();
    
    // 重新渲染频道列表
    renderChannelList();
    
    // 播放该频道
    playChannel(newChannel);
}

// 显示换源弹窗
function showSourceModal() {
    if (currentChannel && currentChannel.sources.length > 1) {
        const sourceList = $('#source-list');
        sourceList.empty();
        
        // 渲染源列表
        currentChannel.sources.forEach((source, index) => {
            const sourceItem = $('<div class="source-item"></div>').text(`源 ${index + 1}`);
            
            // 标记当前激活的源
            if (index === currentSourceIndex) {
                sourceItem.addClass('active');
            }
            
            // 绑定点击事件
            sourceItem.click(function() {
                currentSourceIndex = index;
                const selectedSource = currentChannel.sources[currentSourceIndex];
                playSource(selectedSource, currentChannel.name);
                $('#source-modal').css('display', 'none');
            });
            
            sourceList.append(sourceItem);
        });
        
        // 显示弹窗
        $('#source-modal').css('display', 'block');
    } else {
        alert('当前频道没有多个源可切换');
    }
}

// 切换源（保留原函数，可用于其他地方调用）
function changeSource() {
    if (currentChannel && currentChannel.sources.length > 1) {
        currentSourceIndex = (currentSourceIndex + 1) % currentChannel.sources.length;
        const source = currentChannel.sources[currentSourceIndex];
        playSource(source, currentChannel.name);
    }
}

// 加载默认节目列表
function loadDefaultChannels() {
    console.log('=== 开始加载默认节目列表 ===');
    console.log('默认节目列表URL:', DEFAULT_CHANNEL_URL);
    
    // 重置频道列表
    channels = [];
    channelGroups = {};
    
    // 使用fetch API，添加缓存控制
    fetch(DEFAULT_CHANNEL_URL + '?t=' + new Date().getTime(), {
        cache: 'no-cache',
        headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        }
    })
    .then(function(response) {
        console.log('响应状态:', response.status, '状态文本:', response.statusText);
        if (!response.ok) {
            throw new Error('网络响应失败: ' + response.status + ' ' + response.statusText);
        }
        return response.text();
    })
    .then(function(data) {
        console.log('获取到数据，长度:', data.length);
        console.log('数据前100个字符:', data.substring(0, 100));
        
        // 解析M3U8数据
        parseM3U8(data);
        console.log('节目列表解析完成，频道数量:', channels.length);
        alert('已加载默认节目列表');
    })
    .catch(function(error) {
        console.error('加载默认节目列表失败:', error);
        alert('加载默认节目列表失败: ' + error.message);
    });
}

// 删除频道
function deleteChannel(channelName) {
    // 从频道列表中删除指定频道
    channels = channels.filter(channel => channel.name !== channelName);
    
    // 重新按分组组织频道
    organizeChannelsByGroup();
    
    // 重新渲染频道列表
    renderChannelList();
    
    // 如果删除的是当前播放的频道，清空当前频道
    if (currentChannel && currentChannel.name === channelName) {
        currentChannel = null;
        currentSourceIndex = 0;
    }
}

// 更新当前时间
function updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    $('#current-time').text(timeString);
}
