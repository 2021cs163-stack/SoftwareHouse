import { loginPage } from './pages/login.js';
import { dashboardPage } from './pages/dashboard.js';
import { isConfigured, signIn, signOut } from './services/auth.js';
const app = document.querySelector('#app');
let user = null;
let preview = false;
function render() {
 const dashboard = location.hash === '#dashboard' && (user || preview);
 document.title = `${dashboard ? 'Dashboard' : 'Sign in'} | Rayan Tech Solution`;
 app.innerHTML = dashboard ? dashboardPage(preview) : loginPage(isConfigured);
 if (dashboard) {
  document.querySelector('#sign-out').onclick = async () => { user = null; preview = false; location.hash = 'login'; render(); try { await signOut(); } catch { /* Local session is already cleared. */ } };
  return;
 }
 document.querySelector('#toggle-password').onclick = (event) => {
  const input = document.querySelector('#password'); const show = input.type === 'password'; input.type = show ? 'text' : 'password'; event.currentTarget.textContent = show ? 'Hide' : 'Show'; event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
 };
 document.querySelector('#preview')?.addEventListener('click', () => { preview = true; location.hash = 'dashboard'; });
 document.querySelector('#login-form').onsubmit = async (event) => {
  event.preventDefault(); const button = document.querySelector('#submit'); const error = document.querySelector('#form-error');
  button.disabled = true; button.textContent = 'Signing in…'; error.textContent = '';
  try { user = await signIn(document.querySelector('#email').value.trim(), document.querySelector('#password').value); preview = false; location.hash = 'dashboard'; }
  catch (e) { error.textContent = e instanceof TypeError ? 'Connection failed. Check your internet connection and try again.' : e.message; }
  finally { button.disabled = false; button.innerHTML = 'Sign in <span aria-hidden="true">↗</span>'; }
 };
}
window.addEventListener('hashchange', render);
render();
