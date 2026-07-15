import { ElMessage, ElMessageBox } from 'element-plus'

export function useToast() {
  function toast(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') {
    ElMessage({ message, type, duration: 3000 })
  }

  function success(message: string) { toast(message, 'success') }
  function warning(message: string) { toast(message, 'warning') }
  function error(message: string) { toast(message, 'error') }
  function info(message: string) { toast(message, 'info') }

  async function confirm(message: string, title = '确认操作'): Promise<boolean> {
    try {
      await ElMessageBox.confirm(message, title, { type: 'warning' })
      return true
    } catch {
      return false
    }
  }

  return { toast, success, warning, error, info, confirm }
}
