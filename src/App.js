import React, { useEffect, useState } from 'react';
import {
  Container, Row, Col, Card, Form, Button, ListGroup, Toast, Modal, InputGroup, FormControl
} from 'react-bootstrap';
import api from './services/api';
import { login as doLogin, signup as doSignup } from './services/authService';

function AuthForm({ onAuthSuccess, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Invalid email';
    return '';
  };

  const validatePassword = (value) => {
    if (!value) return 'Password is required';
    if (!isLogin) { 
      if (value.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(value)) return 'Must contain an uppercase letter';
      if (!/[a-z]/.test(value)) return 'Must contain a lowercase letter';
      if (!/\d/.test(value)) return 'Must contain a number';
      if (!/[@$!%*?&]/.test(value)) return 'Must contain a special character @$!%*?&';
    }
    return '';
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setFieldErrors(prev => ({ ...prev, password: validatePassword(e.target.value) }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setFieldErrors({ email: emailErr, password: passwordErr });

    if (emailErr || passwordErr) return;

    setLoading(true);
    try {
      const fn = isLogin ? doLogin : doSignup;
      const res = await fn(email, password);
      localStorage.setItem('token', res.data.token);
      showToast('Logged in successfully', 'success');
      onAuthSuccess();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Auth failed';
      setFieldErrors(prev => ({ ...prev, form: msg }));
      showToast(msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <h4>{isLogin ? 'Login' : 'Sign Up'}</h4>
        <Form onSubmit={submit}>
          <Form.Group className="mb-2">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={handleEmailChange}
              isInvalid={!!fieldErrors.email}
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.email}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={handlePasswordChange}
              isInvalid={!!fieldErrors.password}
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.password}</Form.Control.Feedback>
          </Form.Group>

          {fieldErrors.form && <div className="text-danger mb-2">{fieldErrors.form}</div>}

          <Button type="submit" disabled={loading} className="me-2">
            {isLogin ? 'Login' : 'Sign Up'}
          </Button>
          <Button variant="link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Create an account' : 'Have an account? Login'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}

function App() {
  const [userLoaded, setUserLoaded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'success' });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  const showToast = (msg, variant='success') => setToast({ show: true, msg, variant });

  useEffect(() => {
    const token = localStorage.getItem('token');
    setUserLoaded(!!token);
    if (token) loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterQ) params.q = filterQ;
      const res = await api.get('/tasks', { params });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token'); setUserLoaded(false);
        showToast('Session expired, please login', 'danger');
      }
    }
  };

  useEffect(() => { if(userLoaded) loadTasks(); }, [filterQ, filterStatus, userLoaded]);

  const handleAuthSuccess = () => { setUserLoaded(true); loadTasks(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    try {
      if(editingTask) {
        await api.put(`/tasks/${editingTask._id}`, { title, description, status: editingTask.status });
      } else {
        await api.post('/tasks', { title, description, status: 'pending' });
      }
      setTitle(''); setDescription(''); setEditingTask(null);
      showToast(editingTask ? 'Task updated' : 'Task added', 'success');
      loadTasks();
    } catch (err) {
      if(err.response?.status===400){
        const errors = err.response.data.errors || [];
        const newField = {};
        errors.forEach(x => newField[x.path] = x.msg);
        setFieldErrors(newField);
        showToast('Fix the form errors', 'danger');
      } else if(err.response?.status===401){
        localStorage.removeItem('token'); setUserLoaded(false); showToast('Session expired', 'danger');
      } else showToast('Request failed', 'danger');
    }
  };

  const handleEdit = (task) => { setEditingTask(task); setTitle(task.title); setDescription(task.description); setFieldErrors({}); };
  const toggleStatus = async (task) => { 
    try{ await api.put(`/tasks/${task._id}`, { ...task, status: task.status==='pending'?'done':'pending' }); loadTasks(); }
    catch{ showToast('Update failed','danger'); }
  };

  const confirmDelete = (id) => { setDeleteTaskId(id); setShowDeleteModal(true); };
  const handleDeleteConfirm = async () => {
    try { await api.delete(`/tasks/${deleteTaskId}`); loadTasks(); showToast('Task deleted','success'); }
    catch { showToast('Delete failed','danger'); }
    finally { setShowDeleteModal(false); setDeleteTaskId(null); }
  };

  const logout = () => { localStorage.removeItem('token'); setUserLoaded(false); setTasks([]); showToast('Logged out','success'); };

  if(!userLoaded) return (
    <Container className="mt-5">
      <Row className="justify-content-center"><Col md={6}><AuthForm onAuthSuccess={handleAuthSuccess} showToast={showToast} /></Col></Row>
      <Toast onClose={()=>setToast({...toast,show:false})} show={toast.show} delay={3000} autohide style={{position:'fixed', bottom:20,right:20}}>
        <Toast.Header><strong className="me-auto">Task Manager</strong></Toast.Header>
        <Toast.Body className={`text-${toast.variant==='danger'?'danger':'success'}`}>{toast.msg}</Toast.Body>
      </Toast>
    </Container>
  );

  return (
    <Container className="mt-4">
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h4>Task Manager</h4>
            <Button variant="outline-secondary" onClick={logout}>Logout</Button>
          </div>
        </Col>
      </Row>

      <Row>
        <Col md={4}>
          <Card className="shadow-sm">
            <Card.Body>
              <h5>{editingTask?'Edit Task':'Add Task'}</h5>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-2">
                  <Form.Label>Title</Form.Label>
                  <Form.Control type="text" value={title} onChange={(e)=>{setTitle(e.target.value); if(fieldErrors.title) setFieldErrors(prev=>({...prev,title:null}));}} isInvalid={!!fieldErrors.title} required />
                  <Form.Control.Feedback type="invalid">{fieldErrors.title}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" rows={3} value={description} onChange={(e)=>{setDescription(e.target.value); if(fieldErrors.description) setFieldErrors(prev=>({...prev,description:null}));}} isInvalid={!!fieldErrors.description} />
                  <Form.Control.Feedback type="invalid">{fieldErrors.description}</Form.Control.Feedback>
                </Form.Group>
                <Button type="submit" className="me-2">{editingTask?'Update':'Add'}</Button>
                {editingTask && <Button variant="secondary" onClick={()=>{setEditingTask(null); setTitle(''); setDescription(''); setFieldErrors({});}}>Cancel</Button>}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="p-3 shadow-sm mb-3">
            <InputGroup className="mb-2">
              <FormControl placeholder="Search..." value={filterQ} onChange={e=>setFilterQ(e.target.value)} />
              <Form.Select style={{ width:160 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
              </Form.Select>
              <Button onClick={loadTasks}>Search</Button>
            </InputGroup>

            <ListGroup>
              {tasks.map(t=>(
                <ListGroup.Item key={t._id} className="d-flex justify-content-between align-items-center mb-2 rounded">
                  <div>
                    <h6 className={`mb-1 ${t.status==='done'?'text-decoration-line-through text-muted':''}`}>{t.title}</h6>
                    <small className="text-secondary">{t.description}</small>
                  </div>
                  <div>
                    <Button size="sm" variant={t.status==='done'?'success':'warning'} onClick={()=>toggleStatus(t)} className="me-2">
                      {t.status==='done'?'Done':'Pending'}
                    </Button>
                    <Button size="sm" variant="info" onClick={()=>handleEdit(t)} className="me-2">Edit</Button>
                    <Button size="sm" variant="danger" onClick={()=>confirmDelete(t._id)}>Delete</Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>
      </Row>

      <Toast onClose={()=>setToast({...toast,show:false})} show={toast.show} delay={3000} autohide style={{position:'fixed', bottom:20,right:20}}>
        <Toast.Header><strong className="me-auto">Task Manager</strong></Toast.Header>
        <Toast.Body className={`text-${toast.variant==='danger'?'danger':'success'}`}>{toast.msg}</Toast.Body>
      </Toast>

      <Modal show={showDeleteModal} onHide={()=>setShowDeleteModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Confirm Delete</Modal.Title></Modal.Header>
        <Modal.Body>Are you sure you want to delete this task?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default App;
