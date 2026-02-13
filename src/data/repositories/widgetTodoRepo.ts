import { db } from '../db'
import type { WidgetTodo, WidgetTodoScope } from '../models/types'
import { touch, withBase } from './base'

export const widgetTodoRepo = {
  async list(scope?: WidgetTodoScope) {
    if (scope) {
      return db.widgetTodos.where('scope').equals(scope).toArray()
    }
    return db.widgetTodos.toArray()
  },
  async add(data: Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>) {
    const item = withBase(data)
    await db.widgetTodos.add(item)
    return item
  },
  async update(item: WidgetTodo) {
    const next = touch(item)
    await db.widgetTodos.put(next)
    return next
  },
  async remove(id: string) {
    await db.widgetTodos.delete(id)
  },
}
