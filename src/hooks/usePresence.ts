import { useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

export interface UserPresence {
  uid: string;
  email: string;
  currentPath: string;
  lastActive: any;
  status: 'online' | 'away';
}

export function usePresence() {
  const { user } = useAuth();
  const location = useLocation();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);

  // Update own presence
  useEffect(() => {
    if (!user?.uid) return;

    const presenceRef = doc(db, 'presence', user.uid);
    
    const updatePresence = () => {
      setDoc(presenceRef, {
        uid: user.uid,
        email: user.email,
        currentPath: location.pathname,
        lastActive: serverTimestamp(),
        status: 'online'
      }, { merge: true });
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000); // heartbeat every minute

    // Cleanup on unmount or tab close
    const handleUnload = () => {
      setDoc(presenceRef, { status: 'offline', lastActive: serverTimestamp() }, { merge: true });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user?.uid, user?.email, location.pathname]);

  // Listen to others
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'presence'), (snap) => {
      const now = Date.now();
      const users: UserPresence[] = [];
      snap.forEach(doc => {
        const data = doc.data() as UserPresence;
        // Consider offline if no heartbeat in 2 minutes
        const lastActiveMs = data.lastActive?.toMillis?.() || 0;
        if (data.status === 'online' && (now - lastActiveMs < 120000)) {
          users.push(data);
        }
      });
      setOnlineUsers(users);
    });

    return () => unsub();
  }, [user]);

  return { onlineUsers };
}
