import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut as fbSignOut } from 'firebase/auth';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { db, config } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Skeleton, Modal, Field, Card } from '../components/ui';
import { safeDeleteDoc } from '../lib/logger';
import { confirmDialog } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/hapticEngine';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  createdAt?: any;
}

export default function Users() {
  const { user, role } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (role !== 'admin') return;

    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list: UserData[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as UserData);
        });
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast('Error al cargar usuarios', 'bad');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [role, toast]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q));
  }, [users, search]);

  if (role !== 'admin') {
    return <div className="card" style={{ color: 'var(--bad)' }}>No tienes permisos para ver esta pantalla.</div>;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    if (newPassword.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', 'bad');

    triggerHaptic('light');
    setIsCreating(true);
    let secondaryApp: FirebaseApp | null = null;
    try {
      secondaryApp = initializeApp(config, 'SecondaryApp-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);

      await setDoc(doc(db, 'admins', userCredential.user.uid), {
        email: userCredential.user.email,
        role: newRole,
        createdAt: new Date(),
        createdBy: 'admin_panel',
      });

      let avisoEnviado = true;
      try {
        await sendEmailVerification(userCredential.user);
      } catch (err) {
        avisoEnviado = false;
        console.warn('No se pudo enviar el correo de verificacion:', err);
      }

      await fbSignOut(secondaryAuth);

      triggerHaptic('success');
      toast(
        avisoEnviado
          ? 'Usuario creado. Se le envió un correo de verificación: debe abrirlo antes de poder entrar.'
          : 'Usuario creado, pero no se pudo enviar el correo de verificación.',
        avisoEnviado ? 'ok' : 'bad'
      );
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      setShowModal(false);
    } catch (error: any) {
      triggerHaptic('error');
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast('El correo ya está registrado en Firebase', 'bad');
      } else {
        toast(error.message || 'Error al crear usuario', 'bad');
      }
    } finally {
      setIsCreating(false);
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(console.error);
      }
    }
  };

  const handleRoleChange = async (userId: string, email: string, currentRole: string, targetRole: string) => {
    if (currentRole === targetRole) return;
    triggerHaptic('light');
    const confirmado = await confirmDialog({
      message: `¿Cambiar el rol de ${email} de "${currentRole}" a "${targetRole}"?`,
      danger: targetRole === 'admin',
    });
    if (!confirmado) return;

    try {
      await updateDoc(doc(db, 'admins', userId), { role: targetRole });
      triggerHaptic('success');
      toast('Rol actualizado con éxito', 'ok');
    } catch (err) {
      triggerHaptic('error');
      console.error(err);
      toast('Error al actualizar rol', 'bad');
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    triggerHaptic('warning');
    const confirmado = await confirmDialog({
      message: `¿Seguro que deseas REVOCAR EL ACCESO al usuario ${email}?`,
      danger: true,
    });
    if (!confirmado) return;

    try {
      await safeDeleteDoc(user?.email, doc(db, 'admins', userId), { id: userId });
      triggerHaptic('success');
      toast('Acceso revocado', 'ok');
    } catch (err) {
      triggerHaptic('error');
      console.error(err);
      toast('Error al revocar acceso', 'bad');
    }
  };

  const roleBadges: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: '🛡️ Administrador', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)' },
    manager: { label: '📊 Manager / Supervisor', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' },
    viewer: { label: '👁️ Solo Lectura', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.15)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        className="page-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1>USUARIOS & ROLES DE ACCESO</h1>
          <p>Control de credenciales, privilegios administrativos y seguridad de la plataforma.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary"
          style={{ minHeight: 40, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => {
            triggerHaptic('light');
            setShowModal(true);
          }}
        >
          ➕ Nuevo Usuario
        </motion.button>
      </div>

      {showModal && (
        <Modal title="Dar de Alta Nuevo Usuario" onClose={() => setShowModal(false)}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 20 }}>
            Al registrar a un empleado se crea su cuenta y su permiso en Firestore. Recibirá un correo de verificación necesario para iniciar sesión.
          </p>
          <form onSubmit={handleCreateUser}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div
                onClick={() => {
                  triggerHaptic('light');
                  setNewRole('admin');
                }}
                style={{
                  border: newRole === 'admin' ? '2px solid #3b82f6' : '1px solid var(--border, rgba(255,255,255,0.1))',
                  padding: 14,
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: newRole === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'var(--paper-sunk, rgba(0,0,0,0.2))',
                  transition: 'all 0.15s',
                }}
              >
                <h4 style={{ margin: '0 0 4px', fontSize: 13.5, color: '#60a5fa' }}>🛡️ Administrador</h4>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)' }}>Control total financiero y operativo.</p>
              </div>

              <div
                onClick={() => {
                  triggerHaptic('light');
                  setNewRole('viewer');
                }}
                style={{
                  border: newRole === 'viewer' ? '2px solid #a855f7' : '1px solid var(--border, rgba(255,255,255,0.1))',
                  padding: 14,
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: newRole === 'viewer' ? 'rgba(168, 85, 247, 0.15)' : 'var(--paper-sunk, rgba(0,0,0,0.2))',
                  transition: 'all 0.15s',
                }}
              >
                <h4 style={{ margin: '0 0 4px', fontSize: 13.5, color: '#c084fc' }}>👁️ Visualizador</h4>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)' }}>Solo lectura. Para piso o monitoreo.</p>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Correo Electrónico" full>
                <input
                  type="email"
                  className="input boxed"
                  placeholder="empleado@empresa.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Contraseña Temporal" full>
                <input
                  type="text"
                  className="input boxed"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </Field>
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowModal(false)}
                disabled={isCreating}
              >
                Cancelar
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="btn btn-primary"
                disabled={isCreating}
              >
                {isCreating ? 'Creando Acceso...' : 'Crear Acceso'}
              </motion.button>
            </div>
          </form>
        </Modal>
      )}

      <Card
        title="Directorio de Cuentas Autorizadas"
        hint={`${filteredUsers.length} usuarios activos`}
      >
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <input
              className="search-input"
              type="search"
              placeholder="Buscar por correo o UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: 360, borderRadius: 10 }}
            />
          </div>

          {loading ? (
            <div style={{ padding: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 10, borderRadius: 12 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence>
                {filteredUsers.map((u) => {
                  const badge = roleBadges[u.role] || roleBadges.viewer;
                  const isCurrentUser = u.email === user?.email;

                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 14,
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'var(--surface-raised, rgba(255,255,255,0.02))',
                        border: '1px solid var(--border, rgba(255,255,255,0.08))',
                        borderLeft: `4px solid ${badge.color}`,
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: badge.bg,
                            color: badge.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 15,
                          }}
                        >
                          {u.email ? u.email[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 14, color: 'var(--ink, #fff)' }}>{u.email}</strong>
                            {isCurrentUser && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  color: '#38bdf8',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                TÚ
                              </span>
                            )}
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            UID: {u.id}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <select
                          className="input-field"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            borderRadius: 8,
                            background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
                            border: '1px solid var(--border, rgba(255,255,255,0.1))',
                            color: badge.color,
                            cursor: 'pointer',
                          }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, u.email, u.role, e.target.value)}
                        >
                          <option value="admin">🛡️ Administrador</option>
                          <option value="manager">📊 Manager</option>
                          <option value="viewer">👁️ Visualizador</option>
                        </select>

                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={isCurrentUser}
                          style={{
                            background: 'transparent',
                            color: isCurrentUser ? 'var(--ink-faint)' : 'var(--bad, #ef4444)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 8,
                            cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '6px 12px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          Revocar Acceso
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredUsers.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
                  No se encontraron usuarios coincidentes.
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

