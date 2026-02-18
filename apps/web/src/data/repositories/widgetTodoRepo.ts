import type { WidgetTodo, WidgetTodoScope } from '../models/types'
import { dbService } from '../services/dbService'

export const widgetTodoRepo = {
  async list(scope?: WidgetTodoScope) {
    return dbService.widgetTodos.list(scope)
  },
  async add(data: Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.widgetTodos.add(data)
  },
  async update(item: WidgetTodo) {
    return dbService.widgetTodos.update(item)
  },
  async remove(id: string) {
    await dbService.widgetTodos.remove(id)
  },
}
