import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';

import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut as fbSignOut } from 'firebase/auth';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { db, config } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Skeleton, Modal, Field, Card } from '../components/ui';
import { safeDeleteDoc } from '../lib/logger';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  createdAt?: any;
}

export default function Users() {
  const { user } = useAuth();
  const { role } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (role !== 'admin') return;

    const unsub = onSnapshot(collection(db, 'admins'), (snap) => {
      const list: UserData[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as UserData);
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast('Error al cargar usuarios', 'bad');
      setLoading(false);
    });

    return () => unsub();
  }, [role, toast]);

  if (role !== 'admin') {
    return <div className="card" style={{ color: 'var(--bad)' }}>No tienes permisos para ver esta pantalla.</div>;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    if (newPassword.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', 'bad');
    
    setIsCreating(true);
    let secondaryApp: FirebaseApp | null = null;
    try {
      // Usar una instancia secundaria para no cerrar la sesión del admin actual
      secondaryApp = initializeApp(config, 'SecondaryApp-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      
      // Crear su documento en admins para que las reglas le den paso
      await setDoc(doc(db, 'admins', userCredential.user.uid), {
        email: userCredential.user.email,
        role: newRole,
        createdAt: new Date(),
        createdBy: 'admin_panel'
      });

      // createUserWithEmailAndPassword deja la cuenta con emailVerified=false,
      // y tanto AuthContext como firestore.rules exigen correo verificado. Sin
      // este correo, el empleado recien dado de alta NUNCA podia entrar: se le
      // cerraba la sesion al instante con un mensaje que no explicaba nada.
      let avisoEnviado = true;
      try {
        await sendEmailVerification(userCredential.user);
      } catch (err) {
        avisoEnviado = false;
        console.warn('No se pudo enviar el correo de verificacion:', err);
      }

      await fbSignOut(secondaryAuth);

      toast(
        avisoEnviado
          ? 'Usuario creado. Se le envió un correo de verificación: debe abrirlo antes de poder entrar.'
          : 'Usuario creado, pero no se pudo enviar el correo de verificación. Pídele que use "¿Olvidaste tu contraseña?" para validarlo.',
        avisoEnviado ? 'ok' : 'bad',
      );
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      setShowModal(false);
    } catch (error: any) {
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

  const handleRoleChange = async (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;
    try {
      await updateDoc(doc(db, 'admins', userId), { role: newRole });
      toast('Rol actualizado', 'ok');
    } catch (err) {
      console.error(err);
      toast('Error al actualizar rol', 'bad');
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!window.confirm(`¿Seguro que deseas REVOCAR EL ACCESO al usuario ${email}?`)) return;
    try {
      // Solo borramos el doc en admins. Al hacer esto, las reglas de Firestore bloquean al usuario.
      await safeDeleteDoc(user?.email, doc(db, "admins", userId), { id: userId });
      toast('Acceso revocado', 'ok');
    } catch (err) {
      console.error(err);
      toast('Error al revocar acceso', 'bad');
    }
  };

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Usuarios y Permisos</h1>
          <p>Gestiona quién tiene acceso a la plataforma.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Usuario</button>
      </div>

      {showModal && (
        <Modal title="Dar de Alta Nuevo Usuario" onClose={() => setShowModal(false)}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 20 }}>
            Al registrar a un empleado se le crea la cuenta y su permiso en el sistema. Recibirá un correo de verificación: <strong>tiene que abrirlo antes de poder entrar</strong>. Es un requisito de las reglas de seguridad, no se puede saltar.
          </p>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div onClick={() => setNewRole('admin')} style={{ border: newRole === 'admin' ? '2px solid var(--accent)' : '1px solid var(--line-soft)', padding: 16, borderRadius: 'var(--radius)', cursor: 'pointer', background: newRole === 'admin' ? 'var(--accent-tint)' : 'var(--paper-sunk)', transition: 'all 0.2s' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>🛡️ Administrador</h4>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-faint)' }}>Control total del sistema y finanzas.</p>
              </div>
              <div onClick={() => setNewRole('viewer')} style={{ border: newRole === 'viewer' ? '2px solid var(--accent)' : '1px solid var(--line-soft)', padding: 16, borderRadius: 'var(--radius)', cursor: 'pointer', background: newRole === 'viewer' ? 'var(--accent-tint)' : 'var(--paper-sunk)', transition: 'all 0.2s' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>👁️ Visualizador</h4>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-faint)' }}>Solo lectura. Ideal para clientes o áreas de piso.</p>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Correo Electrónico" full>
                <input type="email" className="input boxed" placeholder="empleado@empresa.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
              </Field>
              <Field label="Contraseña Temporal" full>
                <input type="text" className="input boxed" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
              </Field>
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={isCreating}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isCreating}>
                {isCreating ? 'Creando Acceso...' : 'Crear Acceso'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Card title="Usuarios Autorizados">
        {loading ? (
          <div style={{ padding: 20 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 44, marginBottom: 8 }} />)}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--ink-faint)', fontWeight: 500 }}>Correo</th>
                  <th style={{ padding: '12px 8px', color: 'var(--ink-faint)', fontWeight: 500 }}>UID / ID Interno</th>
                  <th style={{ padding: '12px 8px', color: 'var(--ink-faint)', fontWeight: 500 }}>Rol</th>
                  <th style={{ padding: '12px 8px', color: 'var(--ink-faint)', fontWeight: 500 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--ink-faint)', fontSize: 12, fontFamily: 'monospace' }}>{u.id}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <select 
                        className="input-field" 
                        style={{ padding: '4px 8px', fontSize: 13, minHeight: 'auto', background: 'var(--surface-sunken)' }}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, u.role, e.target.value)}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <button 
                        onClick={() => handleDelete(u.id, u.email)}
                        style={{ background: 'transparent', color: 'var(--bad)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 8px' }}
                      >
                        Revocar Acceso
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-faint)' }}>
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
