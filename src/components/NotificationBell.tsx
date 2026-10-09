import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealTimeNotifications, type AppNotification } from '../hooks/useRealTimeNotifications';
import './NotificationBell.css';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealTimeNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3 style={{ margin: 0 }}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
              >
                <Check size={16} style={{ marginRight: 4 }} />
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No tienes notificaciones.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item ${!n.read ? 'unread' : ''} ${n.action_url ? 'clickable' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notification-icon">{getIcon(n.type)}</div>
                  <div className="notification-content">
                    <h4 className="notification-title">{n.title}</h4>
                    <p className="notification-message">{n.message}</p>
                    <span className="notification-time">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      className="mark-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      title="Marcar como leída"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

