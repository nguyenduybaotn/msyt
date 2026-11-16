const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const yts = require('yt-search');
const { Ytdl } = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;
const ytdl = new Ytdl();

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache for video info (TTL: 1 hour)
const infoCache = new Map();

async function getVideoInfo(videoId) {
  const cached = infoCache.get(videoId);
  if (cached && (Date.now() - cached.timestamp < 3600000)) {
    return cached.data;
  }
  const info = await ytdl.getInfo(videoId);
  infoCache.set(videoId, { data: info, timestamp: Date.now() });
  return info;
}

// Clean old cache entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of infoCache.entries()) {
    if (now - entry.timestamp > 3600000) {
      infoCache.delete(id);
    }
  }
}, 1800000);

// Helper to extract video ID from YouTube URL or raw ID
function extractVideoId(input) {
  if (!input) return null;
  const str = input.trim();
  // Standard full URL: youtube.com/watch?v=ID
  const matchWatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (matchWatch) return matchWatch[1];
  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

// 1. Search API
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check if input is a direct link or ID
    const directId = extractVideoId(q);
    if (directId) {
      try {
        const info = await getVideoInfo(directId);
        const details = info.videoDetails;
        return res.json({
          videos: [{
            id: directId,
            title: details.title,
            thumbnail: details.thumbnails[details.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
            author: details.author ? details.author.name : details.ownerChannelName,
            duration: parseInt(details.lengthSeconds, 10),
            views: details.viewCount,
            published: details.uploadDate
          }]
        });
      } catch (err) {
        console.warn('Failed direct ID lookup, falling back to search:', err.message);
      }
    }

    const searchResults = await yts(q);
    const videos = (searchResults.videos || []).slice(0, 25).map(v => ({
      id: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail || v.image,
      author: v.author ? v.author.name : 'YouTube',
      duration: v.seconds,
      durationFormatted: v.timestamp,
      views: v.views,
      ago: v.ago
    }));

    res.json({ videos });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search YouTube videos' });
  }
});

// 2. Video Suggestions API
app.get('/api/suggest', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) return res.json({ suggestions: [] });

    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    const response = await fetch(suggestUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const data = await response.json();
    res.json({ suggestions: data[1] || [] });
  } catch (err) {
    res.json({ suggestions: [] });
  }
});

// 3. Video Info API
app.get('/api/info', async (req, res) => {
  try {
    const videoId = req.query.v;
    if (!videoId) return res.status(400).json({ error: 'Missing video ID' });

    const info = await getVideoInfo(videoId);
    const d = info.videoDetails;

    // Check available formats
    const hasAudio = info.formats.some(f => f.hasAudio);
    const hasComboVideo = info.formats.some(f => f.hasAudio && f.hasVideo);

    res.json({
      id: videoId,
      title: d.title,
      author: d.author?.name || d.ownerChannelName || 'YouTube',
      thumbnail: d.thumbnails[d.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      duration: parseInt(d.lengthSeconds, 10),
      description: d.description ? d.description.slice(0, 500) : '',
      viewCount: d.viewCount,
      hasComboVideo
    });
  } catch (err) {
    console.error('Info error:', err);
    res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

// 4. Stream Media API (Supports HTTP 206 Partial Content required by iOS Safari)
app.get('/api/stream', async (req, res) => {
  try {
    const videoId = req.query.v;
    const type = req.query.type || 'audio'; // 'audio' or 'video'

    if (!videoId) return res.status(400).send('Missing video ID');

    const info = await getVideoInfo(videoId);
    let selectedFormat = null;

    if (type === 'video') {
      // Find combo format (video + audio) for direct native PiP & playback on iOS
      selectedFormat = info.formats.find(f => f.hasAudio && f.hasVideo && f.container === 'mp4') ||
                       info.formats.find(f => f.hasAudio && f.hasVideo);
    }

    // Default or fallback to high quality audio for background playback
    if (!selectedFormat) {
      selectedFormat = info.formats.find(f => f.hasAudio && !f.hasVideo && f.container === 'mp4') ||
                       info.formats.find(f => f.hasAudio && !f.hasVideo);
    }

    if (!selectedFormat) {
      return res.status(404).send('No compatible media format found');
    }

    const totalSize = parseInt(selectedFormat.contentLength || 0, 10);
    const mimeType = selectedFormat.mimeType ? selectedFormat.mimeType.split(';')[0] : (type === 'video' ? 'video/mp4' : 'audio/mp4');
    const rangeHeader = req.headers.range;

    // If totalSize is not provided by YouTube metadata, stream directly without byte-ranges
    if (!totalSize) {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Accept-Ranges': 'none'
      });
      const stream = ytdl.download(videoId, { format: selectedFormat });
      return stream.pipe(res);
    }

    if (!rangeHeader) {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes'
      });
      const stream = ytdl.download(videoId, { format: selectedFormat });
      return stream.pipe(res);
    }

    // Parse iOS Safari Range request: e.g. "bytes=0-1" or "bytes=0-" or "bytes=1000-5000"
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (end >= totalSize) {
      end = totalSize - 1;
    }

    // Chunk size limiting to optimize buffering and responsiveness on iOS Safari
    const maxChunk = 2 * 1024 * 1024; // 2MB chunk
    if (end - start + 1 > maxChunk) {
      end = start + maxChunk - 1;
    }

    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache'
    });

    const stream = ytdl.download(videoId, {
      format: selectedFormat,
      range: { start, end }
    });

    req.on('close', () => {
      try {
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      } catch (e) {}
    });

    stream.on('error', (err) => {
      console.warn('Stream error chunk:', err.message);
      if (!res.headersSent) res.status(500).end();
    });

    stream.pipe(res);
  } catch (err) {
    console.error('Streaming endpoint error:', err);
    if (!res.headersSent) res.status(500).send('Error during media streaming');
  }
});

// Fallback all non-API routes to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(` YouTube iOS Background Player Web App  `);
  console.log(` Running at http://localhost:${PORT}     `);
  console.log(` On LAN: Open with iPhone at your local IP`);
  console.log(`=========================================`);
});
