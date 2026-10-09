import { PlayCircle, VideoOff } from 'lucide-react'

interface VideoPlayerProps {
  url?: string | null
  title?: string
}

export function VideoPlayer({ url, title = 'Video de la lección' }: VideoPlayerProps) {
  if (!url || !url.trim()) {
    return (
      <div className="video-player-container empty-video">
        <div className="empty-video-placeholder">
          <VideoOff size={44} className="empty-video-icon" />
          <p className="empty-video-title">Esta lección no incluye video</p>
          <p className="empty-video-subtitle">
            Revisa el contenido formativo, explicaciones, prompts y código a continuación.
          </p>
        </div>
      </div>
    )
  }

  const cleanUrl = url.trim()

  // 1. YouTube
  // Formatos: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
  const youtubeMatch = cleanUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/,
  )
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1]
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`
    return (
      <div className="video-player-container">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="video-iframe"
        />
      </div>
    )
  }

  // 2. Vimeo
  // Formatos: vimeo.com/ID
  const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)/)
  if (vimeoMatch && vimeoMatch[2]) {
    const videoId = vimeoMatch[2]
    const embedUrl = `https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0`
    return (
      <div className="video-player-container">
        <iframe
          src={embedUrl}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="video-iframe"
        />
      </div>
    )
  }

  // 3. Direct video format (mp4, webm, ogg, or direct stream)
  const isDirectVideo = /\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(cleanUrl) || cleanUrl.startsWith('blob:')
  if (isDirectVideo) {
    return (
      <div className="video-player-container">
        <video controls className="video-html5" playsInline>
          <source src={cleanUrl} />
          Tu navegador no soporta la reproducción de video HTML5.
        </video>
      </div>
    )
  }

  // Fallback: If it's an unrecognized URL or generic iframe embed
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return (
      <div className="video-player-container">
        <iframe
          src={cleanUrl}
          title={title}
          allowFullScreen
          className="video-iframe"
        />
      </div>
    )
  }

  return (
    <div className="video-player-container empty-video">
      <div className="empty-video-placeholder">
        <PlayCircle size={44} className="empty-video-icon" />
        <p className="empty-video-title">URL de video no válida</p>
      </div>
    </div>
  )
}
