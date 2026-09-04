import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, auth } from '../lib/firebase';
import { useToast } from '../context/ToastContext';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function useFCMNotifications() {
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [messagingInstance, setMessagingInstance] = useState<Messaging | null>(null);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    async function checkSupport() {
      if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        if (active) setIsPushSupported(false);
        return;
      }

      try {
        const supported = await isSupported();
        if (active) {
          setIsPushSupported(supported);
          setPermission(Notification.permission);
          if (supported) {
            const msg = getMessaging(app);
            setMessagingInstance(msg);
          }
        }
      } catch (err) {
        console.warn('[FCM] No soportado en este entorno', err);
        if (active) setIsPushSupported(false);
      }
    }

    void checkSupport();
    return () => { active = false; };
  }, []);

  // Escuchar mensajes cuando la app está abierta en primer plano
  useEffect(() => {
    if (!messagingInstance) return;

    const unsubscribe = onMessage(messagingInstance, (payload) => {
      console.info('[FCM] Notificación recibida en primer plano:', payload);
      const title = payload.notification?.title || payload.data?.title || 'Notificación del ERP';
      const body = payload.notification?.body || payload.data?.body || '';

      toast(`${title}: ${body}`, 'info');

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/favicon.ico',
          });
        } catch {
          // Algunos navegadores móviles sólo permiten notificaciones vía SW
        }
      }
    });

    return () => unsubscribe();
  }, [messagingInstance, toast]);

  const requestPushPermission = useCallback(async () => {
    if (!isPushSupported) {
      toast('Las notificaciones Push no están soportadas en este navegador.', 'info');
      return null;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast('Permiso de notificaciones denegado.', 'bad');
        setLoading(false);
        return null;
      }

      // Registrar el Service Worker específico si no está registrado
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/firebase-cloud-messaging-push-scope',
        });
      }

      const msg = messagingInstance || getMessaging(app);
      const fcmToken = await getToken(msg, {
        serviceWorkerRegistration: swRegistration,
        vapidKey: VAPID_KEY || undefined,
      });

      if (fcmToken) {
        setToken(fcmToken);

        // Guardar token en Firestore para alertas automáticas del backend
        const currentUser = auth.currentUser;
        const tokenId = fcmToken.substring(0, 40); // Clave segura
        await setDoc(doc(db, 'fcm_tokens', tokenId), {
          token: fcmToken,
          userId: currentUser?.uid || 'anonimo',
          userEmail: currentUser?.email || null,
          role: currentUser?.email ? 'admin' : 'viewer',
          platform: navigator.userAgent.includes('Mobi') ? 'mobile' : 'desktop',
          userAgent: navigator.userAgent,
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
        }, { merge: true });

        toast('🔔 Notificaciones Push activadas con éxito.', 'ok');
        setLoading(false);
        return fcmToken;
      }
    } catch (err: any) {
      console.error('[FCM] Error al solicitar token push:', err);
      toast(`No se pudieron activar las notificaciones: ${err.message}`, 'bad');
    } finally {
      setLoading(false);
    }
    return null;
  }, [isPushSupported, messagingInstance, toast]);

  const unsubscribePush = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const tokenId = token.substring(0, 40);
      await deleteDoc(doc(db, 'fcm_tokens', tokenId));
      setToken(null);
      toast('Notificaciones desactivadas.', 'info');
    } catch (err: any) {
      console.warn('[FCM] Error desuscribiendo token:', err);
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  return {
    isPushSupported,
    permission,
    isSubscribed: !!token || permission === 'granted',
    token,
    loading,
    requestPushPermission,
    unsubscribePush,
  };
}
