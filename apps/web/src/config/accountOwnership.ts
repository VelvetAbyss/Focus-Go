export const LOCAL_ACCOUNT_OWNER_KEY = 'focusgo:local-account-owner'

export const assertLocalAccountOwner = (accountId: string) => {
  const owner = localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY)
  if (owner && owner !== accountId) throw new Error('请先退出并清空当前账号的本地数据，再切换账号。')
}

export const bindLocalAccountOwner = (accountId: string) => {
  assertLocalAccountOwner(accountId)
  localStorage.setItem(LOCAL_ACCOUNT_OWNER_KEY, accountId)
}
