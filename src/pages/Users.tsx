import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';

import { getAuth, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { db, config } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  createdAt?: any;
}

export default function Users() {
  const { role } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [isCreating, setIsCreating] = useState(false);

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
    try {
      // Usar una instancia secundaria para no cerrar la sesión del admin actual
      const secondaryApp = initializeApp(config, 'SecondaryApp-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      
      // Crear su documento en admins para que las reglas le den paso
      await setDoc(doc(db, 'admins', userCredential.user.uid), {
        email: userCredential.user.email,
        role: newRole,
        createdAt: new Date(),
        createdBy: 'admin_panel'
      });

      await fbSignOut(secondaryAuth);

      toast('Usuario creado con éxito', 'ok');
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast('El correo ya está registrado en Firebase', 'bad');
      } else {
        toast(error.message || 'Error al crear usuario', 'bad');
      }
    } finally {
      setIsCreating(false);
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
      await deleteDoc(doc(db, 'admins', userId));
      toast('Acceso revocado', 'ok');
    } catch (err) {
      console.error(err);
      toast('Error al revocar acceso', 'bad');
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="card fadeInCard">
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Dar de Alta Nuevo Usuario</h2>
        <p style={{ color: 'var(--ink-faint)', fontSize: 14, marginBottom: 16 }}>
          Al registrar a un empleado desde aquí, se le dará permiso automático para acceder con su correo y contraseña (sin necesidad de verificar el correo con Google).
        </p>
        
        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Correo Electrónico</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="vendedor@empresa.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Contraseña Temporal</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Min 6 caracteres"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Rol</label>
            <select className="input-field" value={newRole} onChange={e => setNewRole(e.target.value as any)}>
              <option value="viewer">Visor (Viewer)</option>
              <option value="manager">Gerente (Manager)</option>
              <option value="admin">Administrador (Admin)</option>
            </select>
          </div>
          <button type="submit" className="primary-btn" disabled={isCreating} style={{ height: 38 }}>
            {isCreating ? 'Creando...' : 'Crear Acceso'}
          </button>
        </form>
      </div>

      <div className="card fadeInCard" style={{ animationDelay: '0.1s' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Usuarios Autorizados</h2>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-faint)' }}>Cargando usuarios...</div>
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
      </div>
    </div>
  );
}
