import { POLICY_VERSION, POLICY_OPERATOR, POLICY_CONTACT } from '../../../focus-go-api/legal/policyManifest.js'
import type { LanguageCode } from '../i18n/types'
export { POLICY_VERSION, POLICY_PREVIOUS_VERSION } from '../../../focus-go-api/legal/policyManifest.js'
export type LegalDocumentKey = 'privacy-policy' | 'terms-of-service'
export type LegalDocument = { title: string; summary: string; updatedAt: string; sections: { heading: string; paragraphs: string[] }[] }
type Pair = readonly [string, string]
type Section = { id: string; heading: Pair; paragraphs: Pair[] }
const terms: Section[] = [
  { id: 'provider', heading: ['服务提供者与范围', 'Provider and scope'], paragraphs: [
    [`Focus&Go 由 ${POLICY_OPERATOR} 以个人身份运营。联系邮箱：${POLICY_CONTACT}。`, `Focus&Go is operated personally by ${POLICY_OPERATOR}. Contact: ${POLICY_CONTACT}.`],
    ['本服务提供任务、笔记、专注、日记及相关个人工作流功能。使用时请遵守适用法律及本条款。', 'The service provides tasks, notes, focus sessions, journals and related personal workflows. Use it in accordance with applicable law and these terms.'],
  ] },
  { id: 'access', heading: ['登录、本地使用与云同步', 'Sign-in, local use and cloud sync'], paragraphs: [
    ['工作台操作需要登录。已经登录的设备在离线时可继续使用已有本地能力，账号状态与具体功能可能影响可用性。', 'Workbench actions require sign-in. A signed-in device can continue using available local capabilities offline, subject to account state and feature availability.'],
    ['内容优先保存在设备本地。开启工作台云同步且账号有效时，支持的内容会在后台传输；联网、配额和同步状态会影响云端是否已有最新副本。', 'Content is saved locally first. When workbench cloud sync is enabled and the account is valid, supported content is transferred in the background. Connectivity, quota and sync status affect whether the cloud has the latest copy.'],
  ] },
  { id: 'price', heading: ['免费、赞助与云空间', 'Free features, sponsorship and cloud storage'], paragraphs: [
    ['当前功能对所有用户免费。自愿赞助不解锁高级功能，也不改变云同步配额；第三方赞助平台的交易规则在其页面展示。', 'Current features are free for all users. Optional sponsorship does not unlock premium features or change the sync allowance. Third-party sponsorship platforms display their own transaction rules.'],
    ['官方云同步默认每账号 250 MiB，实际可用配额以账号中显示的服务端数值为准。达到配额会影响继续上传，不代表本地内容已删除。', 'Official cloud sync defaults to 250 MiB per account. The server allowance displayed in your account is authoritative. Reaching the limit can prevent further uploads; it does not mean local content has been deleted.'],
    ['如未来调整价格或重要功能，我们会说明变化和适用时间；不会因为你曾赞助而自动订阅或扣费。', 'If pricing or important features change, we will explain the changes and when they apply. Prior sponsorship does not automatically create a subscription or authorize charges.'],
  ] },
  { id: 'ownership', heading: ['你的内容归属', 'Ownership of your content'], paragraphs: [
    ['你保留你依法享有的任务、笔记、日记、附件及其他内容权利。使用 Focus&Go 不会把这些内容的所有权转让给 Dylan Feng 或 Focus&Go。第三方素材的权利仍属于其权利人。', 'You retain the rights you lawfully hold in tasks, notes, journals, attachments and other content. Using Focus&Go does not transfer ownership to Dylan Feng or Focus&Go. Third-party material remains subject to its owners’ rights.'],
    ['你应确保有权保存、处理或上传相关内容，不侵犯他人的隐私、知识产权或其他合法权利。', 'You are responsible for having the rights needed to store, process or upload content, without infringing privacy, intellectual property or other lawful rights.'],
  ] },
  { id: 'licence', heading: ['仅为提供服务所需的有限授权', 'A limited permission to provide the service'], paragraphs: [
    ['为执行你请求的本地保存、云同步、格式转换、展示、导出及必要维护，你允许我们在所需范围内处理、复制、存储和传输内容，并由必要的基础设施服务商代为处理。这是非独占、限于服务目的的许可，不转让内容所有权。', 'To perform the local saving, cloud sync, formatting, display, export and necessary maintenance you request, you permit us to process, copy, store and transmit content to the extent needed, including through necessary infrastructure providers. This is a non-exclusive permission limited to providing the service, not a transfer of ownership.'],
    ['此许可不允许我们自行将私人内容公开发布、出售或用于广告，也不因注册而授权将你的内容用于训练通用 AI 模型。超出服务目的的新用途需要另行说明并取得适用的授权。', 'This permission does not allow us to independently publish private content, sell it or use it for advertising. Registration does not authorize using your content to train general AI models. New uses outside the service purpose require separate disclosure and applicable authorization.'],
    ['删除内容或申请注销后，处理权限仅在执行删除、处理争议或履行依法需要保留的义务等必要范围内继续；本地删除、云端删除和最终清理的区别见隐私政策。', 'After content deletion or an account-deletion request, processing is limited to what remains necessary to complete deletion, handle disputes or meet lawful retention obligations. The privacy policy explains local deletion, cloud deletion and final cleanup.'],
  ] },
  { id: 'conduct', heading: ['账号责任与可接受使用', 'Account responsibility and acceptable use'], paragraphs: [
    ['请妥善保管凭据与集成令牌，提供准确账号信息；发现被盗用或安全问题时联系支持。不得未授权访问、绕过安全控制、攻击或滥用接口，或传播恶意代码、垃圾信息及违法侵权内容。', 'Protect credentials and integration tokens, provide accurate account information and contact support about suspected compromise or security issues. Do not access systems without authorization, bypass security controls, attack or abuse APIs, or distribute malware, spam or unlawful infringing content.'],
    ['为处理违规或安全风险，我们可能限制相关访问；紧急风险可能需要立即处理。在允许披露的范围内，你可以联系支持了解原因、申诉及数据处理安排。', 'We may restrict access to address violations or security risks, including immediately for urgent risks. Where disclosure is permitted, contact support for the reason, an appeal and information about data handling.'],
  ] },
  { id: 'exit', heading: ['退出、注销与数据备份', 'Leaving, deletion and backups'], paragraphs: [
    ['退出或切换账号可能清理该设备上的账号工作台数据，不等于注销云端账号。操作前请确认同步状态，并导出需要保留的本地内容。', 'Signing out or switching accounts may clear account workbench data on that device. It does not delete the cloud account. Check sync status and export local content you need before proceeding.'],
    ['账号注销申请经服务器接受后会停用账号、撤销登录及集成令牌，并进入 7 天冷静期。期满后由管理员执行清理；不是到期即自动永久删除。冷静期内申请取消或核实处理情况，请联系支持。', 'Once the server accepts an account-deletion request, it disables the account, revokes sessions and integration tokens, and starts a 7-day cooling period. An administrator performs cleanup after that period; expiry is not automatic permanent deletion. Contact support to request cancellation during the period or check progress.'],
    ['本服务不保证绝不中断或数据绝不丢失。请为重要内容保留独立备份；本条款不排除适用法律规定的不可排除权利或责任。', 'The service does not guarantee uninterrupted operation or that data can never be lost. Keep independent backups of important content. These terms do not exclude rights or liabilities that cannot lawfully be excluded.'],
  ] },
  { id: 'changes', heading: ['版本、变更与联系', 'Versions, changes and contact'], paragraphs: [
    ['政策页展示版本与历史文本。重要变化会通过产品提示等方式说明；已有账号不会被自动记为同意新版本。明确确认时会保存版本、语言、服务器时间和确认来源。', 'Policy pages display the version and historical text. Important changes will be explained through product notices or similar channels. Existing accounts are not automatically recorded as accepting a new version. Explicit confirmation records the versions, language, server time and source.'],
    [`如对条款、数据权利或账号限制有问题，请联系 ${POLICY_CONTACT}。`, `For questions about terms, data rights or account restrictions, contact ${POLICY_CONTACT}.`],
  ] },
]
const privacy: Section[] = [
  { id: 'provider', heading: ['谁处理你的信息', 'Who processes your information'], paragraphs: [
    [`Focus&Go 由 ${POLICY_OPERATOR} 个人运营；隐私及数据请求联系 ${POLICY_CONTACT}。`, `Focus&Go is operated personally by ${POLICY_OPERATOR}. For privacy and data requests, contact ${POLICY_CONTACT}.`],
    ['知悉本政策不等于同意全部可选数据处理。定位、通知、第三方集成等权限按相应功能单独选择；注册确认不授权未来新增的可选用途。', 'Acknowledging this notice does not consent to all optional processing. Choose location, notifications and third-party integrations separately through their controls. Registration does not authorize future optional uses.'],
  ] },
  { id: 'account', heading: ['账号、资料与安全记录', 'Account, profile and security records'], paragraphs: [
    ['登录和账号管理会处理账号 ID、邮箱、显示名称、密码校验信息或第三方登录信息，以及会话 IP、设备信息和相关时间。服务器可根据 IP 推断国家等粗略地域，用于账号相关元数据。', 'Sign-in and account management process account IDs, email, display names, password-verification or third-party sign-in information, session IP addresses, device information and related timestamps. The server may infer a country or similar broad region from the IP address for account metadata.'],
    ['你可选择提供头像、代词、职业、所在地、生日和简介；这些不是创建账号的必填信息。保存的账号资料会发送到服务器，以便不同设备使用同一份资料。', 'You may optionally provide an avatar, pronouns, role, location, birthday and bio. These are not required to create an account. Saved account profiles are sent to the server so devices can use the same profile.'],
    ['服务条款确认和隐私告知的版本、语言、服务器时间及来源会按账号记录；不会将未勾选、仅浏览或历史登录伪记为已确认。', 'The confirmed terms version, acknowledged privacy version, language, server time and source are recorded per account. An unchecked box, viewing a page or a historical sign-in is not recorded as confirmation.'],
  ] },
  { id: 'content', heading: ['本地内容与云端副本', 'Local content and cloud copies'], paragraphs: [
    ['任务、笔记、日记、专注记录、附件和偏好等优先保存在设备的本地存储中。启用工作台云同步后，支持的数据副本会传输到我们的服务器及必要基础设施；上传完成前不能把本地保存当作云端已有副本。', 'Tasks, notes, journals, focus records, attachments and preferences are saved on the device first. Enabling workbench cloud sync transfers supported copies to our servers and necessary infrastructure. Local saving is not proof of a completed cloud upload.'],
    ['关闭工作台内容同步不会停止登录、账号资料保存、安全管理或你主动请求的其他联网功能。', 'Turning off workbench content sync does not stop sign-in, account-profile saving, security management or other online functions you request.'],
    ['我们不因提供存储服务而取得你的内容所有权；处理范围限于服务条款中的有限许可。', 'Providing storage does not give us ownership of your content. Processing is limited by the service permission in the terms.'],
  ] },
  { id: 'optional', heading: ['可选功能与第三方', 'Optional features and third parties'], paragraphs: [
    ['开启自动天气定位时，浏览器会请求定位权限；天气及地理编码查询可能向 Open-Meteo、wttr.in 等服务发送城市或经纬度。你可以关闭自动定位并使用手动城市。', 'With automatic weather location enabled, the browser requests location permission. Weather and geocoding queries may send a city or coordinates to services such as Open-Meteo and wttr.in. You can disable automatic location and use a manual city.'],
    ['Google 登录及外部赞助平台分别处理你在其页面提交的信息，并适用其政策。你自行填写的个人第三方 API key 按现有功能保存在当前设备，不纳入工作台云同步或文档备份；浏览器存储不是专用密钥保险箱。', 'Google sign-in and external sponsorship platforms process information you submit to them under their policies. Personal third-party API keys you enter are currently stored on the device and excluded from workbench sync and document backups. Browser storage is not a dedicated secrets vault.'],
    ['必要的登录 Cookie、本地存储和 IndexedDB 用于会话、内容与偏好。可选分析或推广用途如有引入，将另行说明及提供适用的选择；不会因注册而取得出售私人内容的许可。', 'Necessary sign-in cookies, local storage and IndexedDB support sessions, content and preferences. Optional analytics or promotional uses, if introduced, will be disclosed separately with applicable choices. Registration does not permit selling private content.'],
  ] },
  { id: 'retention', heading: ['保存、删除与退出的区别', 'Retention, deletion and sign-out'], paragraphs: [
    ['本地数据可能因清理站点数据、重置、设备损坏或相关账号操作而消失。导出的是该设备已有内容，不应把它理解为完整云端归档。', 'Local data may be lost through clearing site data, resets, device damage or account actions. An export contains content available on that device; it is not a complete cloud archive.'],
    ['清理本地、清理云同步数据、退出账号和申请注销是不同操作。注销经服务器接受后先停用并撤销访问，进入 7 天冷静期，期满后由管理员清理；需取消或核实进度时联系支持。', 'Clearing local data, clearing cloud-sync data, signing out and requesting account deletion are different actions. An accepted deletion request first disables the account and revokes access, starts a 7-day cooling period, then becomes eligible for administrator cleanup. Contact support to cancel or check progress.'],
    ['本政策不将停用、冷静期届满或本地清理等同于所有副本立即永久删除。仍需履行依法保留的义务；如需确认具体删除范围与完成情况，请联系我们。', 'Disabling an account, expiry of the cooling period or local cleanup does not mean every copy is immediately and permanently deleted. Lawful retention obligations may still apply. Contact us to confirm the deletion scope and completion.'],
  ] },
  { id: 'rights', heading: ['你的选择、请求与政策版本', 'Your choices, requests and policy versions'], paragraphs: [
    ['你可以使用现有功能更正资料、导出内容、管理同步及定位权限，并申请注销。访问、更正、删除或处理争议可发至支持邮箱；我们会核验身份并说明处理结果或限制。', 'Use the available controls to correct profiles, export content, manage sync and location permissions, and request account deletion. Send access, correction, deletion or disputed-processing requests to support; we will verify identity and explain the outcome or limitations.'],
    ['政策展示版本与历史文本，重要变化会另行提示。此确认只记录已展示版本，不构成对未来政策、可选权限或额外用途的预先授权。', 'The policy displays its version and historical text. Important changes will be highlighted separately. Confirmation covers only the displayed edition, not future policies, optional permissions or additional uses.'],
  ] },
]
const makeDocument = (key: LegalDocumentKey, lang: LanguageCode): LegalDocument => {
  const index = lang === 'zh' ? 0 : 1
  return { title: key === 'privacy-policy' ? ['隐私政策', 'Privacy Policy'][index] : ['服务条款', 'Terms of Service'][index], summary: key === 'privacy-policy' ? ['账号、内容与可选功能的数据处理说明。', 'How account, content and optional-feature data are handled.'][index] : ['服务规则、你的内容权利与有限服务授权。', 'Service rules, your content rights and limited service permission.'][index], updatedAt: POLICY_VERSION, sections: (key === 'privacy-policy' ? privacy : terms).map(section => ({ heading: section.heading[index], paragraphs: section.paragraphs.map(pair => pair[index]) })) }
}
export const LEGAL_DOCUMENTS = Object.fromEntries((['zh', 'en'] as const).map(lang => [lang, { 'privacy-policy': makeDocument('privacy-policy', lang), 'terms-of-service': makeDocument('terms-of-service', lang) }])) as Record<LanguageCode, Record<LegalDocumentKey, LegalDocument>>
export const policyConfirmation = (locale: LanguageCode) => ({ termsAccepted: true, privacyAcknowledged: true, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale })
export const policyUrl = (key: LegalDocumentKey, lang: LanguageCode, version = POLICY_VERSION) => `/legal/${key}?lang=${lang}&version=${encodeURIComponent(version)}`
