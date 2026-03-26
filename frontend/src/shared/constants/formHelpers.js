export const PROPERTY_FIELDS = [
  { key: 'name', label: '이름', placeholder: 'Name', defaultMatch: 'Name' },
  { key: 'url', label: 'URL', placeholder: 'URL', defaultMatch: 'URL' },
  { key: 'description', label: '설명', placeholder: 'Description', defaultMatch: 'Description' },
  { key: 'last_commit', label: '마지막 커밋', placeholder: 'Last Commit', defaultMatch: 'Last Commit' },
  { key: 'commit_count', label: '커밋 수', placeholder: 'Commit Count', defaultMatch: 'Commit Count' },
  { key: 'visibility', label: '가시성', placeholder: 'Visibility', defaultMatch: 'Visibility' },
  { key: 'repo_id', label: '저장소 ID', placeholder: 'repository-id', defaultMatch: 'repository-id' },
]

export function createEmptyAccount() {
  return { name: '', type: 'user', label: '' }
}
