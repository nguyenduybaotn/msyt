// YouPlay - YouTube Background Player for iOS (Dual Engine: Native + Cloud YouTube Engine)
(function() {
  'use strict';

  // Detect capability from server
  let canStreamDirectly = true;
  fetch('/api/status').then(r => r.json()).then(data => {
    canStreamDirectly = data.canStream;
    state.engine = canStreamDirectly ? 'native' : 'youtube';
  }).catch(() => {
    canStreamDirectly = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname.startsWith('192.168.');
    state.engine = canStreamDirectly ? 'native' : 'youtube';
  });

  // State Management
  const state = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    mode: 'audio', // 'audio' or 'video'
    engine: isLocalHost ? 'native' : 'youtube', // 'native' for local stream, 'youtube' for Cloud
    isShuffle: false,
    repeatMode: 0, // 0: None, 1: Repeat One, 2: Repeat All
    playbackRate: 1.0,
    favorites: JSON.parse(localStorage.getItem('youplay_favorites') || '[]'),
    history: JSON.parse(localStorage.getItem('youplay_history') || '[]')
  };

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const searchForm = document.getElementById('searchForm');
  const clearSearchBtn = document.getElementById('clearSearch');
  const suggestionsBox = document.getElementById('suggestionsBox');
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  const videoGrid = document.getElementById('videoGrid');
  const resultsHeading = document.getElementById('resultsHeading');
  const queueList = document.getElementById('queueList');
  const favoritesList = document.getElementById('favoritesList');
  const historyList = document.getElementById('historyList');
  const queueCount = document.getElementById('queueCount');

  // Mini Player
  const miniPlayer = document.getElementById('miniPlayer');
  const miniPlayerClick = document.getElementById('miniPlayerClick');
  const miniThumbnail = document.getElementById('miniThumbnail');
  const miniTitle = document.getElementById('miniTitle');
  const miniAuthor = document.getElementById('miniAuthor');
  const miniPlayBtn = document.getElementById('miniPlayBtn');
  const miniPrevBtn = document.getElementById('miniPrevBtn');
  const miniNextBtn = document.getElementById('miniNextBtn');
  const miniProgressFill = document.getElementById('miniProgressFill');

  // Full Player
  const fullPlayer = document.getElementById('fullPlayer');
  const sheetCloseBar = document.getElementById('sheetCloseBar');
  const btnMinimizePlayer = document.getElementById('btnMinimizePlayer');
  const modeAudioBtn = document.getElementById('modeAudio');
  const modeVideoBtn = document.getElementById('modeVideo');
  const audioVisualizer = document.getElementById('audioVisualizer');
  const videoContainer = document.getElementById('videoContainer');
  const ytPlayerContainer = document.getElementById('ytPlayerContainer');
  const playerCover = document.getElementById('playerCover');
  const playerTitle = document.getElementById('playerTitle');
  const playerAuthor = document.getElementById('playerAuthor');
  const btnFavCurrent = document.getElementById('btnFavCurrent');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressFill = document.getElementById('progressFill');
  const progressThumb = document.getElementById('progressThumb');
  const currentTimeEl = document.getElementById('currentTime');
  const totalDurationEl = document.getElementById('totalDuration');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnRepeat = document.getElementById('btnRepeat');
  const btnTogglePip = document.getElementById('btnTogglePip');
  const btnQuickPip = document.getElementById('btnQuickPip');
  const btnPlaybackRate = document.getElementById('btnPlaybackRate');
  const btnShare = document.getElementById('btnShare');

  // Media Elements
  const audioElement = document.getElementById('audioElement');
  const videoElement = document.getElementById('videoElement');
  const silentAudio = document.getElementById('silentAudio');

  // Modals & Navigation
  const btnHelp = document.getElementById('btnHelp');
  const helpModal = document.getElementById('helpModal');
  const btnCloseHelp = document.getElementById('btnCloseHelp');
  const btnUnderstand = document.getElementById('btnUnderstand');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabViews = {
    explore: document.getElementById('tabExplore'),
    queue: document.getElementById('tabQueue'),
    favorites: document.getElementById('tabFavorites'),
    history: document.getElementById('tabHistory')
  };

  // YouTube IFrame Player API
  let ytPlayer = null;
  let ytReady = false;
  let ytProgressTimer = null;

  window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('ytPlayer', {
      height: '100%',
      width: '100%',
      playerVars: {
        playsinline: 1,
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          ytReady = true;
          if (state.currentTrack && state.engine === 'youtube') {
            ytPlayer.loadVideoById(state.currentTrack.id);
          }
        },
        onStateChange: onYtStateChange
      }
    });
  };

  function onYtStateChange(event) {
    if (state.engine !== 'youtube') return;

    if (event.data === YT.PlayerState.PLAYING) {
      state.isPlaying = true;
      updatePlayPauseUI(true);
      startTimer();
      try { silentAudio.play(); } catch (e) {}
    } else if (event.data === YT.PlayerState.PAUSED) {
      state.isPlaying = false;
      updatePlayPauseUI(false);
      stopTimer();
      try { silentAudio.pause(); } catch (e) {}
    } else if (event.data === YT.PlayerState.ENDED) {
      handleMediaEnded();
    }
  }

  // Silent Audio Generator to preserve iOS Background Audio Session
  function initSilentAudio() {
    try {
      const sampleRate = 8000;
      const numFrames = sampleRate;
      const buffer = new ArrayBuffer(44 + numFrames);
      const view = new DataView(buffer);
      function writeStr(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numFrames, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeStr(36, 'data');
      view.setUint32(40, numFrames, true);
      for (let i = 0; i < numFrames; i++) view.setUint8(44 + i, 128);
      
      const blob = new Blob([buffer], { type: 'audio/wav' });
      silentAudio.src = URL.createObjectURL(blob);
    } catch (e) {
      console.warn('Silent audio init error:', e);
    }
  }
  initSilentAudio();

  // Helper: Active media element for native mode
  function getActiveMedia() {
    return state.mode === 'video' ? videoElement : audioElement;
  }

  // Format seconds to mm:ss or hh:mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Save State
  function saveFavorites() {
    localStorage.setItem('youplay_favorites', JSON.stringify(state.favorites));
    updateFavButtonUI();
    renderFavorites();
  }

  function saveHistory() {
    localStorage.setItem('youplay_history', JSON.stringify(state.history));
    renderHistory();
  }

  function addToHistory(track) {
    state.history = state.history.filter(t => t.id !== track.id);
    state.history.unshift(track);
    if (state.history.length > 50) state.history.pop();
    saveHistory();
  }

  function toggleFavorite(track) {
    const idx = state.favorites.findIndex(t => t.id === track.id);
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
    } else {
      state.favorites.unshift(track);
    }
    saveFavorites();
  }

  function updateFavButtonUI() {
    if (!state.currentTrack) return;
    const isFav = state.favorites.some(t => t.id === state.currentTrack.id);
    btnFavCurrent.innerHTML = isFav 
      ? '<i class="fa-solid fa-heart" style="color: #ff0055;"></i>' 
      : '<i class="fa-regular fa-heart"></i>';
  }

  // Setup Media Session API (Critical for iOS Lock Screen & Background Playback)
  function setupMediaSession(track) {
    if (!('mediaSession' in navigator)) return;

    const artworkUrl = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author || 'YouTube',
      album: 'YouPlay iOS Background',
      artwork: [
        { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', playMedia);
    navigator.mediaSession.setActionHandler('pause', pauseMedia);
    navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const cur = getCurrentPlaybackTime();
      seekToTime(Math.max(cur - (details.seekOffset || 10), 0));
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const cur = getCurrentPlaybackTime();
      seekToTime(cur + (details.seekOffset || 10));
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      seekToTime(details.seekTime);
    });
  }

  function getCurrentPlaybackTime() {
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      return ytPlayer.getCurrentTime() || 0;
    }
    return getActiveMedia().currentTime || 0;
  }

  function getPlaybackDuration() {
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.getDuration === 'function') {
      const d = ytPlayer.getDuration();
      if (d && d > 0) return d;
    }
    return getActiveMedia().duration || (state.currentTrack ? state.currentTrack.duration : 0);
  }

  function seekToTime(time) {
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(time, true);
    } else {
      getActiveMedia().currentTime = time;
    }
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const dur = getPlaybackDuration();
    const cur = getCurrentPlaybackTime();
    if (dur && !isNaN(dur) && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: state.playbackRate || 1.0,
          position: Math.min(cur, dur)
        });
      } catch (e) {}
    }
  }

  // Play a Track
  async function loadAndPlay(track, addToQueueList = true) {
    state.currentTrack = track;
    addToHistory(track);

    if (addToQueueList) {
      const existingIdx = state.queue.findIndex(t => t.id === track.id);
      if (existingIdx === -1) {
        state.queue.push(track);
        state.queueIndex = state.queue.length - 1;
      } else {
        state.queueIndex = existingIdx;
      }
      renderQueue();
    }

    // Update UI elements
    miniPlayer.style.display = 'flex';
    miniThumbnail.src = track.thumbnail;
    miniTitle.textContent = track.title;
    miniAuthor.textContent = track.author;

    playerCover.src = track.thumbnail;
    playerTitle.textContent = track.title;
    playerAuthor.textContent = track.author;
    updateFavButtonUI();

    // Setup MediaSession immediately
    setupMediaSession(track);

    // Stop Native media
    audioElement.pause();
    videoElement.pause();
    stopTimer();

    // If server supports direct streaming (Local or Tunnel or with Cookie), use Native Audio for 100% Lock Screen Playback
    if (canStreamDirectly) {
      try {
        const streamType = state.mode;
        const media = getActiveMedia();
        media.src = `/api/stream?v=${track.id}&type=${streamType}`;
        media.playbackRate = state.playbackRate;
        await media.play();
        state.engine = 'native';
        state.isPlaying = true;
        updatePlayPauseUI(true);
        updateViewVisibility();
        return;
      } catch (e) {
        console.warn('Native stream failed, falling back to YouTube Player:', e);
      }
    }

    // Cloud Fallback / Default: YouTube Player Engine
    state.engine = 'youtube';
    updateViewVisibility();

    try {
      await silentAudio.play();
    } catch (e) {}

    playYouTubeTrack(track.id);
  }

  function playYouTubeTrack(videoId) {
    if (ytReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      try {
        ytPlayer.loadVideoById({
          videoId: videoId,
          startSeconds: 0
        });
        ytPlayer.playVideo();
        state.isPlaying = true;
        updatePlayPauseUI(true);
        startTimer();
        return;
      } catch (err) {
        console.warn('ytPlayer.loadVideoById error, falling back to direct iframe:', err);
      }
    }

    // Direct IFrame Fallback if YouTube API script is still loading
    ytPlayerContainer.innerHTML = `
      <iframe 
        id="ytIframeDirect" 
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1" 
        style="width: 100%; height: 100%; border: none;" 
        allow="autoplay; encrypted-media; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
    state.isPlaying = true;
    updatePlayPauseUI(true);
    startTimer();
  }

  function updateViewVisibility() {
    if (state.engine === 'youtube') {
      videoContainer.style.display = 'none';
      if (state.mode === 'video') {
        ytPlayerContainer.style.opacity = '1';
        ytPlayerContainer.style.pointerEvents = 'auto';
        ytPlayerContainer.style.zIndex = '10';
        audioVisualizer.style.display = 'none';
      } else {
        // Audio Mode: Keep iframe active in DOM with tiny opacity so iOS Safari doesn't suspend audio
        ytPlayerContainer.style.opacity = '0.01';
        ytPlayerContainer.style.pointerEvents = 'none';
        ytPlayerContainer.style.zIndex = '1';
        audioVisualizer.style.display = 'flex';
      }
    } else {
      ytPlayerContainer.style.opacity = '0';
      ytPlayerContainer.style.pointerEvents = 'none';
      ytPlayerContainer.style.zIndex = '0';
      if (state.mode === 'video') {
        videoContainer.style.display = 'block';
        audioVisualizer.style.display = 'none';
      } else {
        videoContainer.style.display = 'none';
        audioVisualizer.style.display = 'flex';
      }
    }
  }

  function playMedia() {
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.playVideo === 'function') {
      ytPlayer.playVideo();
      try { silentAudio.play(); } catch (e) {}
    } else {
      getActiveMedia().play().catch(e => console.warn(e));
    }
    state.isPlaying = true;
    updatePlayPauseUI(true);
  }

  function pauseMedia() {
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      ytPlayer.pauseVideo();
      try { silentAudio.pause(); } catch (e) {}
    } else {
      getActiveMedia().pause();
    }
    state.isPlaying = false;
    updatePlayPauseUI(false);
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pauseMedia();
    } else {
      if (!state.currentTrack && state.queue.length > 0) {
        loadAndPlay(state.queue[0]);
      } else {
        playMedia();
      }
    }
  }

  function playNext() {
    if (state.queue.length === 0) return;
    if (state.isShuffle) {
      state.queueIndex = Math.floor(Math.random() * state.queue.length);
    } else {
      state.queueIndex = (state.queueIndex + 1) % state.queue.length;
    }
    loadAndPlay(state.queue[state.queueIndex], false);
    renderQueue();
  }

  function playPrevious() {
    if (state.queue.length === 0) return;
    const curTime = getCurrentPlaybackTime();
    if (curTime > 4) {
      seekToTime(0);
      return;
    }
    state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
    loadAndPlay(state.queue[state.queueIndex], false);
    renderQueue();
  }

  function updatePlayPauseUI(playing) {
    const playIcon = '<i class="fa-solid fa-play"></i>';
    const pauseIcon = '<i class="fa-solid fa-pause"></i>';
    btnPlayPause.innerHTML = playing ? pauseIcon : playIcon;
    miniPlayBtn.innerHTML = playing ? pauseIcon : playIcon;

    if (playing) {
      fullPlayer.classList.add('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
      fullPlayer.classList.remove('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  }

  function handleMediaEnded() {
    if (state.repeatMode === 1) {
      seekToTime(0);
      playMedia();
    } else if (state.queue.length > 0) {
      if (state.queueIndex === state.queue.length - 1 && state.repeatMode !== 2 && !state.isShuffle) {
        state.isPlaying = false;
        updatePlayPauseUI(false);
      } else {
        playNext();
      }
    }
  }

  // Switch Mode (Audio vs Video)
  function setMode(newMode) {
    if (state.mode === newMode) return;
    state.mode = newMode;

    if (newMode === 'audio') {
      modeAudioBtn.classList.add('active');
      modeVideoBtn.classList.remove('active');
    } else {
      modeVideoBtn.classList.add('active');
      modeAudioBtn.classList.remove('active');
    }

    updateViewVisibility();
  }

  // Picture-in-Picture
  async function triggerPictureInPicture() {
    setMode('video');
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoElement.requestPictureInPicture) {
        await videoElement.requestPictureInPicture();
      } else if (videoElement.webkitSetPresentationMode) {
        const curMode = videoElement.webkitPresentationMode;
        videoElement.webkitSetPresentationMode(curMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      } else {
        alert('Vui lòng bấm vào nút toàn màn hình hoặc PiP trong khung video.');
      }
    } catch (err) {
      console.warn('PiP notice:', err);
    }
  }

  // Progress Timer for YouTube Engine
  function startTimer() {
    stopTimer();
    ytProgressTimer = setInterval(() => {
      const cur = getCurrentPlaybackTime();
      const dur = getPlaybackDuration();
      currentTimeEl.textContent = formatTime(cur);
      if (dur && !isNaN(dur) && dur > 0) {
        totalDurationEl.textContent = formatTime(dur);
        const pct = (cur / dur) * 100;
        progressFill.style.width = `${pct}%`;
        progressThumb.style.left = `${pct}%`;
        miniProgressFill.style.width = `${pct}%`;
      }
      updatePositionState();
    }, 500);
  }

  function stopTimer() {
    if (ytProgressTimer) {
      clearInterval(ytProgressTimer);
      ytProgressTimer = null;
    }
  }

  // Native Media Event Listeners
  function onNativeTimeUpdate(e) {
    if (state.engine !== 'native') return;
    const media = e.target;
    if (media !== getActiveMedia()) return;
    const cur = media.currentTime || 0;
    const dur = media.duration || (state.currentTrack ? state.currentTrack.duration : 0);

    currentTimeEl.textContent = formatTime(cur);
    if (dur && !isNaN(dur)) {
      totalDurationEl.textContent = formatTime(dur);
      const pct = (cur / dur) * 100;
      progressFill.style.width = `${pct}%`;
      progressThumb.style.left = `${pct}%`;
      miniProgressFill.style.width = `${pct}%`;
    }
    updatePositionState();
  }

  audioElement.addEventListener('timeupdate', onNativeTimeUpdate);
  videoElement.addEventListener('timeupdate', onNativeTimeUpdate);
  audioElement.addEventListener('ended', handleMediaEnded);
  videoElement.addEventListener('ended', handleMediaEnded);

  audioElement.addEventListener('play', () => { if (state.engine === 'native' && state.mode === 'audio') updatePlayPauseUI(true); });
  audioElement.addEventListener('pause', () => { if (state.engine === 'native' && state.mode === 'audio') updatePlayPauseUI(false); });
  videoElement.addEventListener('play', () => { if (state.engine === 'native' && state.mode === 'video') updatePlayPauseUI(true); });
  videoElement.addEventListener('pause', () => { if (state.engine === 'native' && state.mode === 'video') updatePlayPauseUI(false); });

  // Progress Bar Seek
  function seekToPosition(e) {
    const rect = progressBarContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = clickX / rect.width;
    const dur = getPlaybackDuration();
    const targetTime = pct * dur;
    seekToTime(targetTime);
  }

  progressBarContainer.addEventListener('click', seekToPosition);
  progressBarContainer.addEventListener('touchmove', seekToPosition);

  // Search Functionality
  let searchDebounce = null;

  async function performSearch(query) {
    if (!query || !query.trim()) return;
    loader.style.display = 'flex';
    loaderText.textContent = `Đang tìm "${query}"...`;
    suggestionsBox.style.display = 'none';
    videoGrid.innerHTML = '';
    resultsHeading.textContent = `Kết quả cho "${query}"`;

    switchTab('explore');

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      loader.style.display = 'none';

      if (!data.videos || data.videos.length === 0) {
        videoGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-face-frown"></i><p>Không tìm thấy video nào.</p></div>';
        return;
      }

      renderVideoCards(data.videos, videoGrid);
    } catch (err) {
      loader.style.display = 'none';
      videoGrid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Đã xảy ra lỗi khi tìm kiếm.</p></div>';
    }
  }

  function renderVideoCards(videos, container) {
    container.innerHTML = '';
    videos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-card';
      const durationText = v.durationFormatted || formatTime(v.duration);
      card.innerHTML = `
        <div class="video-thumb-wrap">
          <img src="${v.thumbnail}" alt="${v.title}" loading="lazy">
          <span class="video-duration">${durationText}</span>
        </div>
        <div class="video-meta">
          <h3 class="video-title">${v.title}</h3>
          <p class="video-author">${v.author}</p>
          <p class="video-extra-info">${v.ago ? v.ago + ' • ' : ''}${v.views ? Number(v.views).toLocaleString('vi-VN') + ' lượt xem' : ''}</p>
        </div>
      `;
      card.addEventListener('click', () => {
        loadAndPlay(v, true);
        openFullPlayer();
      });
      container.appendChild(card);
    });
  }

  // Suggestions Fetch
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    clearSearchBtn.style.display = val ? 'block' : 'none';

    clearTimeout(searchDebounce);
    if (!val || val.length < 2) {
      suggestionsBox.style.display = 'none';
      return;
    }

    searchDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          suggestionsBox.innerHTML = '';
          data.suggestions.slice(0, 7).forEach(s => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span>${s}</span>`;
            item.addEventListener('click', () => {
              searchInput.value = s;
              suggestionsBox.style.display = 'none';
              performSearch(s);
            });
            suggestionsBox.appendChild(item);
          });
          suggestionsBox.style.display = 'block';
        } else {
          suggestionsBox.style.display = 'none';
        }
      } catch (e) {
        suggestionsBox.style.display = 'none';
      }
    }, 250);
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    suggestionsBox.style.display = 'none';
    performSearch(searchInput.value);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    suggestionsBox.style.display = 'none';
    searchInput.focus();
  });

  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = 'none';
    }
  });

  // Render Queue, Favorites, History
  function renderQueue() {
    queueCount.textContent = state.queue.length;
    if (state.queue.length === 0) {
      queueList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-ul"></i><p>Hàng đợi trống. Chọn video để thêm vào!</p></div>';
      return;
    }
    queueList.innerHTML = '';
    state.queue.forEach((item, idx) => {
      const card = createListItem(item, idx === state.queueIndex, () => {
        state.queueIndex = idx;
        loadAndPlay(item, false);
      }, () => {
        state.queue.splice(idx, 1);
        if (state.queueIndex > idx) state.queueIndex--;
        renderQueue();
      });
      queueList.appendChild(card);
    });
  }

  function renderFavorites() {
    if (state.favorites.length === 0) {
      favoritesList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-heart"></i><p>Chưa có bài hát yêu thích nào.</p></div>';
      return;
    }
    favoritesList.innerHTML = '';
    state.favorites.forEach((item) => {
      const card = createListItem(item, state.currentTrack && state.currentTrack.id === item.id, () => {
        loadAndPlay(item, true);
      }, () => {
        toggleFavorite(item);
      }, 'fa-trash');
      favoritesList.appendChild(card);
    });
  }

  function renderHistory() {
    if (state.history.length === 0) {
      historyList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>Chưa có lịch sử phát.</p></div>';
      return;
    }
    historyList.innerHTML = '';
    state.history.forEach((item) => {
      const card = createListItem(item, state.currentTrack && state.currentTrack.id === item.id, () => {
        loadAndPlay(item, true);
      });
      historyList.appendChild(card);
    });
  }

  function createListItem(track, isActive, onClick, onDelete, deleteIcon = 'fa-xmark') {
    const el = document.createElement('div');
    el.className = `video-card ${isActive ? 'active-track' : ''}`;
    el.style.borderLeft = isActive ? '4px solid #ff0055' : '';
    el.innerHTML = `
      <div class="video-thumb-wrap" style="width: 80px; height: 50px;">
        <img src="${track.thumbnail}" alt="${track.title}" loading="lazy">
      </div>
      <div class="video-meta">
        <h3 class="video-title" style="font-size: 13px;">${track.title}</h3>
        <p class="video-author" style="font-size: 11px;">${track.author}</p>
      </div>
      ${onDelete ? `<button class="icon-btn delete-btn" style="width: 30px; height: 30px; font-size: 11px; align-self: center;"><i class="fa-solid ${deleteIcon}"></i></button>` : ''}
    `;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      onClick();
    });

    if (onDelete) {
      el.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete();
      });
    }
    return el;
  }

  // Navigation Tabs Switch
  function switchTab(tabName) {
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    Object.keys(tabViews).forEach(key => {
      tabViews[key].classList.toggle('active', key === tabName);
    });

    if (tabName === 'queue') renderQueue();
    if (tabName === 'favorites') renderFavorites();
    if (tabName === 'history') renderHistory();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Player Open & Close
  function openFullPlayer() {
    fullPlayer.classList.add('open');
  }

  function closeFullPlayer() {
    fullPlayer.classList.remove('open');
  }

  miniPlayerClick.addEventListener('click', openFullPlayer);
  sheetCloseBar.addEventListener('click', closeFullPlayer);
  btnMinimizePlayer.addEventListener('click', closeFullPlayer);

  // Playback Control Handlers
  btnPlayPause.addEventListener('click', togglePlayPause);
  miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  btnNext.addEventListener('click', playNext);
  miniNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playNext();
  });
  btnPrev.addEventListener('click', playPrevious);
  miniPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playPrevious();
  });

  // Shuffle & Repeat
  btnShuffle.addEventListener('click', () => {
    state.isShuffle = !state.isShuffle;
    btnShuffle.classList.toggle('active', state.isShuffle);
  });

  btnRepeat.addEventListener('click', () => {
    state.repeatMode = (state.repeatMode + 1) % 3;
    if (state.repeatMode === 0) {
      btnRepeat.classList.remove('active');
      btnRepeat.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    } else if (state.repeatMode === 1) {
      btnRepeat.classList.add('active');
      btnRepeat.innerHTML = '<i class="fa-solid fa-repeat"></i><span style="font-size:9px; vertical-align:super;">1</span>';
    } else {
      btnRepeat.classList.add('active');
      btnRepeat.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    }
  });

  // Playback Rate
  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
  btnPlaybackRate.addEventListener('click', () => {
    const curIdx = speeds.indexOf(state.playbackRate);
    const nextIdx = (curIdx + 1) % speeds.length;
    state.playbackRate = speeds[nextIdx];
    btnPlaybackRate.textContent = `${state.playbackRate}x`;
    audioElement.playbackRate = state.playbackRate;
    videoElement.playbackRate = state.playbackRate;
    if (state.engine === 'youtube' && ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
      ytPlayer.setPlaybackRate(state.playbackRate);
    }
  });

  // PiP Handlers
  btnTogglePip.addEventListener('click', triggerPictureInPicture);
  btnQuickPip.addEventListener('click', triggerPictureInPicture);

  // Mode Switch
  modeAudioBtn.addEventListener('click', () => setMode('audio'));
  modeVideoBtn.addEventListener('click', () => setMode('video'));

  // Favorite button in full player
  btnFavCurrent.addEventListener('click', () => {
    if (state.currentTrack) toggleFavorite(state.currentTrack);
  });

  // Share
  btnShare.addEventListener('click', () => {
    if (!state.currentTrack) return;
    const shareUrl = `https://youtu.be/${state.currentTrack.id}`;
    if (navigator.share) {
      navigator.share({
        title: state.currentTrack.title,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Đã sao chép link YouTube vào clipboard!');
      });
    }
  });

  // Help Modal
  btnHelp.addEventListener('click', () => { helpModal.style.display = 'flex'; });
  btnCloseHelp.addEventListener('click', () => { helpModal.style.display = 'none'; });
  btnUnderstand.addEventListener('click', () => { helpModal.style.display = 'none'; });
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.style.display = 'none';
  });

  // Clear lists
  document.getElementById('btnClearQueue').addEventListener('click', () => {
    state.queue = [];
    state.queueIndex = -1;
    renderQueue();
  });
  document.getElementById('btnClearFavorites').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa tất cả bài hát yêu thích?')) {
      state.favorites = [];
      saveFavorites();
    }
  });
  document.getElementById('btnClearHistory').addEventListener('click', () => {
    state.history = [];
    saveHistory();
  });

  // Initial Load: Fetch Trending Music
  async function loadTrending() {
    loader.style.display = 'flex';
    loaderText.textContent = 'Đang tải gợi ý âm nhạc...';
    try {
      const res = await fetch('/api/search?q=nhạc trẻ hot tiktok');
      const data = await res.json();
      loader.style.display = 'none';
      if (data.videos && data.videos.length > 0) {
        renderVideoCards(data.videos, videoGrid);
      }
    } catch (e) {
      loader.style.display = 'none';
    }
  }

  // Register PWA Service Worker if available
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // Initial execution
  loadTrending();
  renderQueue();
  renderFavorites();
  renderHistory();

})();
