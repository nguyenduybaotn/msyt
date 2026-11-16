// YouPlay - YouTube Background Player for iOS
(function() {
  'use strict';

  // State Management
  const state = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    mode: 'audio', // 'audio' or 'video'
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

  // Helper: Active media element based on state.mode
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
    if (isFav) {
      btnFavCurrent.innerHTML = '<i class="fa-solid fa-heart" style="color: #ff0055;"></i>';
    } else {
      btnFavCurrent.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
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

    navigator.mediaSession.setActionHandler('play', () => {
      playMedia();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      pauseMedia();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const media = getActiveMedia();
      media.currentTime = Math.max(media.currentTime - (details.seekOffset || 10), 0);
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const media = getActiveMedia();
      media.currentTime = Math.min(media.currentTime + (details.seekOffset || 10), media.duration || 0);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const media = getActiveMedia();
      if (details.fastSeek && 'fastSeek' in media) {
        media.fastSeek(details.seekTime);
      } else {
        media.currentTime = details.seekTime;
      }
    });
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const media = getActiveMedia();
    if (media.duration && !isNaN(media.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: media.duration,
          playbackRate: media.playbackRate || 1.0,
          position: media.currentTime
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

    // Stop and reset current audio/video
    audioElement.pause();
    videoElement.pause();

    const media = getActiveMedia();
    const streamType = state.mode;
    media.src = `/api/stream?v=${track.id}&type=${streamType}`;
    media.playbackRate = state.playbackRate;

    try {
      await media.play();
      state.isPlaying = true;
      updatePlayPauseUI(true);
    } catch (err) {
      console.warn('Playback autoplay waiting for user interaction:', err);
      state.isPlaying = false;
      updatePlayPauseUI(false);
    }
  }

  function playMedia() {
    const media = getActiveMedia();
    media.play().then(() => {
      state.isPlaying = true;
      updatePlayPauseUI(true);
    }).catch(err => console.warn(err));
  }

  function pauseMedia() {
    const media = getActiveMedia();
    media.pause();
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
    const media = getActiveMedia();
    if (media.currentTime > 4) {
      media.currentTime = 0;
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

  // Handle Track Completion
  function handleMediaEnded() {
    if (state.repeatMode === 1) {
      // Repeat current track
      const media = getActiveMedia();
      media.currentTime = 0;
      media.play();
    } else if (state.queue.length > 0) {
      if (state.queueIndex === state.queue.length - 1 && state.repeatMode !== 2 && !state.isShuffle) {
        // Reached end of playlist without repeat all
        state.isPlaying = false;
        updatePlayPauseUI(false);
      } else {
        playNext();
      }
    }
  }

  // Switch between Audio and Video mode seamlessly
  function setMode(newMode) {
    if (state.mode === newMode) return;
    const prevMedia = getActiveMedia();
    const currentTime = prevMedia.currentTime || 0;
    const wasPlaying = !prevMedia.paused;

    prevMedia.pause();
    state.mode = newMode;

    if (newMode === 'audio') {
      modeAudioBtn.classList.add('active');
      modeVideoBtn.classList.remove('active');
      audioVisualizer.style.display = 'flex';
      videoContainer.style.display = 'none';
    } else {
      modeVideoBtn.classList.add('active');
      modeAudioBtn.classList.remove('active');
      audioVisualizer.style.display = 'none';
      videoContainer.style.display = 'block';
    }

    if (state.currentTrack) {
      const nextMedia = getActiveMedia();
      nextMedia.src = `/api/stream?v=${state.currentTrack.id}&type=${newMode}`;
      nextMedia.playbackRate = state.playbackRate;
      nextMedia.currentTime = currentTime;
      if (wasPlaying) {
        nextMedia.play().catch(e => console.warn(e));
      }
    }
  }

  // Picture-in-Picture Trigger
  async function triggerPictureInPicture() {
    if (state.mode !== 'video') {
      setMode('video');
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoElement.requestPictureInPicture) {
        await videoElement.requestPictureInPicture();
      } else if (videoElement.webkitSetPresentationMode) {
        // iOS Safari WebKit specific API
        const currentMode = videoElement.webkitPresentationMode;
        videoElement.webkitSetPresentationMode(currentMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      } else {
        alert('Thiết bị hoặc trình duyệt này không hỗ trợ Picture-in-Picture.');
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }

  // Progress Sync
  function onTimeUpdate(e) {
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

  audioElement.addEventListener('timeupdate', onTimeUpdate);
  videoElement.addEventListener('timeupdate', onTimeUpdate);
  audioElement.addEventListener('ended', handleMediaEnded);
  videoElement.addEventListener('ended', handleMediaEnded);

  audioElement.addEventListener('play', () => { if (state.mode === 'audio') updatePlayPauseUI(true); });
  audioElement.addEventListener('pause', () => { if (state.mode === 'audio') updatePlayPauseUI(false); });
  videoElement.addEventListener('play', () => { if (state.mode === 'video') updatePlayPauseUI(true); });
  videoElement.addEventListener('pause', () => { if (state.mode === 'video') updatePlayPauseUI(false); });

  // Progress Bar Seek
  function seekToPosition(e) {
    const media = getActiveMedia();
    const rect = progressBarContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = clickX / rect.width;
    const targetTime = pct * (media.duration || (state.currentTrack ? state.currentTrack.duration : 0));
    media.currentTime = targetTime;
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

    // Switch to explore tab
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

  // Initial Load: Fetch Trending Music for Explore Tab
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
