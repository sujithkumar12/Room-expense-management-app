import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import type { Member, RoomActivity } from '../types';

type ActivitySort = 'newest' | 'oldest';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function activityIcon(type: string) {
  switch (type) {
    case 'expense_added':
      return '💸';
    case 'settlement_added':
      return '✅';
    case 'member_joined':
      return '👋';
    case 'member_left':
    case 'member_removed':
      return '👤';
    case 'room_renamed':
      return '✏️';
    case 'admin_transferred':
      return '👑';
    default:
      return '📌';
  }
}

export function RoomActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const roomId = Number(id);
  const [roomName, setRoomName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<RoomActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | string>('all');
  const [activitySort, setActivitySort] = useState<ActivitySort>('newest');

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    setError('');
    Promise.all([api.getRoom(roomId), api.getRoomActivity(roomId)])
      .then(([roomData, activityData]) => {
        setRoomName(roomData.room.name);
        setMembers(roomData.members);
        setActivities(activityData.activities);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      })
      .finally(() => setLoading(false));
  }, [roomId]);

  const filterMembers = useMemo(() => {
    const me = members.find((m) => m.id === user?.id);
    const others = members
      .filter((m) => m.id !== user?.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return me ? [me, ...others] : others;
  }, [members, user?.id]);

  const filteredActivities = useMemo(() => {
    let list = [...activities];

    if (memberFilter !== 'all') {
      list = list.filter((item) => item.actor_name === memberFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.message.toLowerCase().includes(q) ||
          item.actor_name.toLowerCase().includes(q) ||
          item.activity_type.replace(/_/g, ' ').includes(q)
      );
    }

    list.sort((a, b) => {
      const cmp = a.created_at.localeCompare(b.created_at);
      return activitySort === 'newest' ? -cmp : cmp;
    });

    return list;
  }, [activities, memberFilter, searchQuery, activitySort]);

  if (loading) {
    return (
      <Layout>
        <div className="loading-inline"><div className="spinner" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="activity-page">
        <div className="page-header">
          <div>
            <Link to={`/rooms/${roomId}`} className="back-link">← Back to room</Link>
            <h1>Activity log</h1>
            <p className="text-muted">{roomName} · {activities.length} events</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="activity-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search activity"
          />
          <select
            className="sort-select"
            value={activitySort}
            onChange={(e) => setActivitySort(e.target.value as ActivitySort)}
            aria-label="Sort activity"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {filterMembers.length > 0 && (
          <div className="expense-tabs activity-filter-tabs" role="tablist" aria-label="Filter by roommate">
            <button
              type="button"
              role="tab"
              className={`expense-tab${memberFilter === 'all' ? ' active' : ''}`}
              onClick={() => setMemberFilter('all')}
            >
              All
              <span className="tab-count">{activities.length}</span>
            </button>
            {filterMembers.map((member) => {
              const count = activities.filter((a) => a.actor_name === member.name).length;
              return (
                <button
                  key={member.id}
                  type="button"
                  role="tab"
                  className={`expense-tab${memberFilter === member.name ? ' active' : ''}`}
                  onClick={() => setMemberFilter(member.name)}
                >
                  {member.id === user?.id ? 'You' : member.name.split(' ')[0]}
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {filteredActivities.length === 0 ? (
          <p className="text-muted empty-text activity-empty">
            {activities.length === 0
              ? 'No activity yet in this room.'
              : 'No activity matches your search or filter.'}
          </p>
        ) : (
          <div className="activity-feed-full">
            {filteredActivities.map((item) => (
              <div key={item.id} className="activity-row">
                <span className="activity-icon" aria-hidden>{activityIcon(item.activity_type)}</span>
                <div className="activity-body">
                  <p className="activity-message">{item.message}</p>
                  <span className="text-muted activity-meta">
                    {item.actor_name} · {formatRelativeTime(item.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
