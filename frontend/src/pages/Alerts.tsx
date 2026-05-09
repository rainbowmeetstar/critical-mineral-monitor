import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Bell, BellOff, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const DIRECTION_LABEL = { above: '价格高于', below: '价格低于' }
const DIRECTION_COLOR = { above: 'text-red-400', below: 'text-emerald-400' }

export default function Alerts() {
  const qc = useQueryClient()
  const [mineralId, setMineralId] = useState<number | ''>('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [threshold, setThreshold] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
    refetchInterval: 60_000,
  })

  const { data: triggers = [] } = useQuery({
    queryKey: ['alert-triggers'],
    queryFn: api.getAlertTriggers,
    refetchInterval: 60_000,
  })

  const { data: minerals = [] } = useQuery({
    queryKey: ['minerals'],
    queryFn: () => api.getMinerals(),
  })

  const createMut = useMutation({
    mutationFn: api.createAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      setMineralId(''); setThreshold(''); setNote(''); setFormError('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: api.deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  function handleCreate() {
    if (!mineralId) return setFormError('请选择矿产')
    const val = parseFloat(threshold)
    if (isNaN(val) || val <= 0) return setFormError('请输入有效阈值')
    setFormError('')
    createMut.mutate({ mineral_id: Number(mineralId), direction, threshold: val, note: note || undefined })
  }

  const mineralsWithPrice = minerals.filter(m => m.latest_price !== null)

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> 新建价格预警
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">矿产</label>
            <select
              value={mineralId}
              onChange={e => setMineralId(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500 min-w-[160px]"
            >
              <option value="">选择矿产...</option>
              {minerals.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name_zh ?? m.name} ({m.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">触发条件</label>
            <div className="flex gap-1">
              {(['above', 'below'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    direction === d ? 'bg-orange-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  {DIRECTION_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">阈值</label>
            <input
              type="number"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              placeholder="如: 9000"
              className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white w-32 outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-stone-500 mb-1.5">备注（可选）</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="备注说明"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMut.isPending ? '创建中...' : '创建预警'}
          </button>
        </div>
        {formError && <p className="text-red-400 text-xs mt-2">{formError}</p>}

        {/* Reference prices */}
        {mineralsWithPrice.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-800">
            <p className="text-xs text-stone-500 mb-2">最新参考价格</p>
            <div className="flex flex-wrap gap-2">
              {mineralsWithPrice.slice(0, 10).map(m => (
                <span key={m.id} className="text-xs bg-stone-800 px-2 py-1 rounded text-stone-400">
                  {m.name_zh ?? m.name}: <span className="text-orange-300">{m.latest_price?.price.toFixed(2)}</span> {m.latest_price?.unit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert rules */}
        <div>
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" /> 预警规则
            <span className="text-xs text-stone-500 font-normal ml-1">({alerts.length})</span>
          </h2>
          {alerts.length === 0 ? (
            <div className="card text-center py-10 text-stone-500">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无预警规则</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {a.mineral_name_zh ?? a.mineral_name}
                      </span>
                      <span className={`text-xs ${DIRECTION_COLOR[a.direction as keyof typeof DIRECTION_COLOR]}`}>
                        {DIRECTION_LABEL[a.direction as keyof typeof DIRECTION_LABEL]} {a.threshold}
                      </span>
                    </div>
                    {a.note && <p className="text-xs text-stone-500 mt-0.5">{a.note}</p>}
                    <p className="text-xs text-stone-600 mt-0.5">
                      触发 {a.trigger_count} 次
                      {a.last_triggered_at && ` · 最近 ${formatDistanceToNow(new Date(a.last_triggered_at), { addSuffix: true, locale: zhCN })}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMut.mutate(a.id)}
                    className="p-1.5 text-stone-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent triggers */}
        <div>
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> 近期触发记录
            <span className="text-xs text-stone-500 font-normal ml-1">(7天内)</span>
          </h2>
          {triggers.length === 0 ? (
            <div className="card text-center py-10 text-stone-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">近期无预警触发</p>
            </div>
          ) : (
            <div className="space-y-2">
              {triggers.map(t => (
                <div key={t.id} className="card flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      t.direction === 'above' ? 'bg-red-400' : 'bg-emerald-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{t.mineral_name}</span>
                      <span className={`text-xs ${DIRECTION_COLOR[t.direction as keyof typeof DIRECTION_COLOR]}`}>
                        {DIRECTION_LABEL[t.direction as keyof typeof DIRECTION_LABEL]} {t.threshold}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">
                      触发价格: <span className="text-orange-300">{t.price_at_trigger.toFixed(2)}</span>
                      {' · '}
                      {formatDistanceToNow(new Date(t.triggered_at), { addSuffix: true, locale: zhCN })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
