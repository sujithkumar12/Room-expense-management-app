import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { Room } from '../types';

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRooms = async () => {
    try {
      const { rooms: data } = await api.getRooms();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createRoom(roomName);
      setRoomName('');
      setShowCreate(false);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.joinRoom(inviteCode);
      setInviteCode('');
      setShowJoin(false);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Your Rooms</h1>
          <p className="text-muted">Create a new room or join with an invite code</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            Join Room
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            + Create Room
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showCreate && (
        <div className="card form-card">
          <h3>Create a new room</h3>
          <form onSubmit={handleCreate} className="inline-form">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name (e.g. Flat 3B)"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              Create
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="card form-card">
          <h3>Join with invite code</h3>
          <form onSubmit={handleJoin} className="inline-form">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              required
              maxLength={8}
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              Join
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-inline"><div className="spinner" /></div>
      ) : rooms.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-icon">🛋️</span>
          <h3>No rooms yet</h3>
          <p>Create your first room or join one using an invite code from a roommate.</p>
        </div>
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <Link key={room.id} to={`/rooms/${room.id}`} className="room-card card">
              <div className="room-card-header">
                <h3>{room.name}</h3>
                <span className="badge">{room.member_count ?? 0} members</span>
              </div>
              <p className="invite-code">Code: <strong>{room.invite_code}</strong></p>
              <span className="room-card-link">Open room →</span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
