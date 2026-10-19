import type { LanguageCode } from '../i18n/types'
import type { LegalDocument, LegalDocumentKey } from './policies'

export const LEGACY_LEGAL_DOCUMENTS: Record<LanguageCode, Record<LegalDocumentKey, LegalDocument>> = {
  en: {
    'privacy-policy': {
      title: 'Privacy Policy',
      summary: 'How Focus&go collects, stores, and uses information when you use the app.',
      updatedAt: 'March 30, 2026',
      sections: [
        {
          heading: 'Information we collect',
          paragraphs: [
            'Focus&go stores the content you create in the app, such as tasks, notes, focus sessions, diary entries, preferences, and other workspace data.',
            'When you sign in for official cloud sync, we may also receive basic account details such as your user ID, display name, email address, supporter acknowledgement, and sync-quota status.',
          ],
        },
        {
          heading: 'Local storage and cloud sync',
          paragraphs: [
            'Most product data is stored locally on your device so the app can work quickly and remain usable even when network conditions are unstable.',
            'If you choose to enable official cloud sync, synced copies of your workspace data are transmitted to our servers or trusted infrastructure providers. Official sync requires an account and has a 250 MiB per-account allowance; local data remains available without it.',
          ],
        },
        {
          heading: 'Third-party services',
          paragraphs: [
            'We may rely on third-party services for authentication, hosting, analytics, crash reporting, storage, and related infrastructure. Those services only receive the information required to provide their part of the product.',
            'We do not sell your personal information to advertisers or data brokers.',
          ],
        },
        {
          heading: 'Data retention',
          paragraphs: [
            'Locally stored data remains on your device until you delete it, reset the app, or remove the application.',
            'If remote services are used, we retain data only for as long as necessary to operate the product, meet legal obligations, resolve disputes, and enforce our agreements.',
          ],
        },
        {
          heading: 'Your rights and choices',
          paragraphs: [
            'You can review, edit, export, import, or delete local data using the controls provided inside the app.',
            'If your account data is processed by remote services, you may contact us to request access, correction, or deletion, subject to applicable law and legitimate operational needs.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'If you have privacy questions or requests, contact us at support@nestflow.art.',
          ],
        },
      ],
    },
    'terms-of-service': {
      title: 'Terms of Service',
      summary: 'The basic rules, responsibilities, and limitations that apply when you use Focus&go.',
      updatedAt: 'March 30, 2026',
      sections: [
        {
          heading: 'Service overview',
          paragraphs: [
            'Focus&go is a productivity workspace for managing tasks, notes, focus sessions, diary entries, and related personal workflows.',
            'We may update, improve, limit, or discontinue features at any time as the product evolves.',
          ],
        },
        {
          heading: 'Account responsibility',
          paragraphs: [
            'You are responsible for maintaining control of your account credentials and for activity that occurs under your account.',
            'You must provide accurate information when creating or using an account-backed feature.',
          ],
        },
        {
          heading: 'Acceptable use',
          paragraphs: [
            'You may not use the service to break the law, abuse other users, interfere with infrastructure, reverse engineer restricted systems, or attempt unauthorized access.',
            'You may not upload or distribute malicious code, spam, or content that violates applicable rights or regulations.',
          ],
        },
        {
          heading: 'Free features and cloud sync',
          paragraphs: [
            'All current Focus&go features are free. Local use does not require an account; an account is only needed for the optional official cloud sync service.',
            'Official cloud sync includes 250 MiB of storage per account. Optional sponsorship does not unlock features or change this allowance.',
          ],
        },
        {
          heading: 'Disclaimers',
          paragraphs: [
            'The service is provided on an as-is and as-available basis. We do not guarantee uninterrupted operation, perfect accuracy, or permanent availability of every feature.',
            'You are responsible for keeping your own backups when data continuity is important to you.',
          ],
        },
        {
          heading: 'Termination and changes',
          paragraphs: [
            'We may suspend or terminate access if you violate these terms or use the service in a way that creates legal, operational, or security risk.',
            'We may revise these terms from time to time. Continued use of the service after updates means you accept the revised terms.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'Questions about these terms can be sent to support@nestflow.art.',
          ],
        },
      ],
    },
  },
  zh: {
    'privacy-policy': {
      title: '隐私政策',
      summary: '说明 Focus&go 在你使用产品时会收集、存储和使用哪些信息。',
      updatedAt: '2026 年 3 月 30 日',
      sections: [
        {
          heading: '我们收集的信息',
          paragraphs: [
            'Focus&go 会保存你在产品中创建的内容，例如任务、笔记、专注记录、日记、偏好设置及其他工作台数据。',
            '当你登录时，我们也可能接收基础账号信息，例如用户 ID、显示名称、邮箱地址和订阅状态。',
          ],
        },
        {
          heading: '本地存储与云同步',
          paragraphs: [
            '大多数产品数据会优先保存在你的设备本地，以保证速度和离线可用性。',
            '如果未来你的账号等级支持云同步，工作台数据的同步副本可能会传输到我们的服务器或受信任的基础设施服务商。',
          ],
        },
        {
          heading: '第三方服务',
          paragraphs: [
            '我们可能会使用第三方服务提供登录、托管、分析、崩溃监控、存储等基础能力。这些服务只会接收完成相应功能所需的信息。',
            '我们不会向广告商或数据中介出售你的个人信息。',
          ],
        },
        {
          heading: '数据保留',
          paragraphs: [
            '保存在本地的数据会一直留在你的设备上，直到你主动删除、重置应用，或卸载产品。',
            '如果使用了远端服务，我们只会在提供产品、履行法律义务、解决争议和执行协议所需的期间内保留数据。',
          ],
        },
        {
          heading: '你的权利与选择',
          paragraphs: [
            '你可以通过应用内提供的能力查看、编辑、导出、导入或删除本地数据。',
            '如果你的账号数据被远端服务处理，你可以联系我们提出访问、更正或删除请求，但仍需遵守适用法律和合理的运营要求。',
          ],
        },
        {
          heading: '联系我们',
          paragraphs: [
            '如果你有任何隐私相关的问题或请求，请联系 support@nestflow.art。',
          ],
        },
      ],
    },
    'terms-of-service': {
      title: '服务条款',
      summary: '说明你在使用 Focus&go 时需要遵守的基本规则、责任和限制。',
      updatedAt: '2026 年 3 月 30 日',
      sections: [
        {
          heading: '服务说明',
          paragraphs: [
            'Focus&go 是一个用于管理任务、笔记、专注、日记及相关个人工作流的效率工作台。',
            '随着产品演进，我们可能会随时更新、增强、限制或下线部分功能。',
          ],
        },
        {
          heading: '账号责任',
          paragraphs: [
            '你需要妥善保管自己的账号凭证，并对账号下发生的行为负责。',
            '当你创建账号或使用依赖账号的功能时，应提供真实、准确的信息。',
          ],
        },
        {
          heading: '可接受使用',
          paragraphs: [
            '你不得利用本服务从事违法行为、骚扰他人、干扰基础设施、逆向受限系统，或尝试未授权访问。',
            '你不得上传或传播恶意代码、垃圾信息，或侵犯他人权利、违反适用法规的内容。',
          ],
        },
        {
          heading: '订阅与高级功能',
          paragraphs: [
            '部分功能可能仅对高级版开放，具体的高级功能范围可能随着产品发展而调整。',
            '如果未来引入或更新计费能力，价格、续费和取消规则会在购买时明确展示。',
          ],
        },
        {
          heading: '免责声明',
          paragraphs: [
            '本服务按“现状”和“可用”基础提供。我们不保证服务绝不中断、结果绝对准确，也不保证所有功能永久可用。',
            '当数据连续性对你很重要时，你应自行保留备份。',
          ],
        },
        {
          heading: '终止与变更',
          paragraphs: [
            '如果你违反本条款，或以可能带来法律、运营或安全风险的方式使用服务，我们可以暂停或终止你的访问权限。',
            '我们可能不时更新这些条款。条款更新后继续使用服务，即表示你接受修订后的内容。',
          ],
        },
        {
          heading: '联系我们',
          paragraphs: [
            '如果你对这些条款有任何问题，请发送邮件至 support@nestflow.art。',
          ],
        },
      ],
    },
  },
}
