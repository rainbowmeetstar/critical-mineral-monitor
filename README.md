# 关键矿产监测平台 | Critical Mineral Monitor

实时追踪全球关键矿产信息的综合监测系统，涵盖稀土元素、电池金属、战略矿产和铂族金属。

## 功能

### 数据覆盖
- **矿产数据库**: 30+ 种关键矿产（17种稀土 + 战略/电池/铂族金属），含中英文名称、主要用途、产地分布、战略重要性评分
- **价格监测**: 通过 Yahoo Finance 实时获取铜、金、银、铂、钯等商品期货价格；锂、稀土通过 ETF 代理价格
- **资讯追踪**: 自动抓取 Mining.com、Kitco News、Mining Weekly、USGS 等多源 RSS 新闻
- **政策动向**: USGS 国家矿产信息中心政策公告抓取

### 信息层次
| 层次 | 来源 |
|------|------|
| 政府层面 | USGS、各国地质调查局、IEA |
| 行业协会层面 | Mining.com、Mining Weekly、Kitco |
| 企业层面 | 各矿业公司财报、公告（规划中）|

### 技术架构
```
backend/        Python + FastAPI + SQLAlchemy (SQLite)
  crawlers/     数据抓取模块（价格/RSS新闻/USGS）
  models/       数据库模型（矿产、价格、新闻）
  api/          REST API 接口
  scheduler.py  APScheduler 定时任务

frontend/       React 18 + TypeScript + Vite
  pages/        总览 / 价格行情 / 资讯动态 / 矿产数据库
  components/   可复用 UI 组件
```

## 快速启动

### 方式一：Docker Compose（推荐）
```bash
docker-compose up --build
```
访问 http://localhost:3000

### 方式二：本地开发

**后端**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# API: http://localhost:8000
# 文档: http://localhost:8000/docs
```

**前端**
```bash
cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/minerals` | 矿产列表（支持 category 筛选）|
| GET | `/api/v1/minerals/{id}` | 矿产详情 |
| GET | `/api/v1/minerals/{id}/prices` | 价格历史（支持 days 参数）|
| GET | `/api/v1/news` | 资讯列表（支持 category/level/mineral 筛选）|
| GET | `/api/v1/stats` | 仪表板统计 |
| POST | `/api/v1/crawl/all` | 触发全量数据抓取 |
| POST | `/api/v1/crawl/prices` | 触发价格更新 |
| POST | `/api/v1/crawl/news` | 触发新闻更新 |

## 价格数据说明

| 矿产 | 数据来源 | 更新频率 |
|------|----------|----------|
| 铜 (HG=F) | COMEX 期货 | 每小时 |
| 金 (GC=F) | COMEX 期货 | 每小时 |
| 铂 (PL=F) | NYMEX 期货 | 每小时 |
| 钯 (PA=F) | NYMEX 期货 | 每小时 |
| 锂 (LIT ETF) | NYSE ETF代理 | 每小时 |
| 稀土 (REMX ETF) | NYSE ETF代理 | 每小时 |
| 钕 (MP Materials) | NYSE股票代理 | 每小时 |

> **注**: 稀土单品种实时价格（钕、镝、铽等）在中国上海金属市场(SMM)和Fastmarkets等机构，
> 均为付费数据。当前版本使用 REMX ETF 和 MP Materials 股价作为代理指标。
> 生产版可对接 SMM API 或 Fastmarkets API。

## 规划功能
- [ ] 世界矿产分布地图（Leaflet.js）
- [ ] 企业层面：主要矿业公司财报、生产数据
- [ ] 中文政策文件：自然资源部、工信部公告抓取
- [ ] 价格预警：设定阈值，触发通知
- [ ] 导出功能：CSV / Excel
- [ ] 稀土单品种价格：对接 SMM API
