import SegmentedControl from './SegmentedControl'

// Switches between dashboard pages through the URL hash (#customers), so each page has
// its own link and the browser back button works. No router needed for a few pages.
const PAGES = [
  { value: 'sales', label: 'ยอดขาย', hash: '' },
  { value: 'customers', label: 'ลูกค้า', hash: '#customers' },
  { value: 'lab2', label: 'Lab 2.2', hash: '#lab2' },
]

function PageTabs({ value }) {
  const go = (next) => {
    if (next === value) return
    window.location.hash = PAGES.find((p) => p.value === next).hash
    window.scrollTo({ top: 0 })
  }
  return (
    <nav aria-label="เลือกหน้า" className="rise mb-4 sm:mb-6" style={{ animationDelay: '40ms' }}>
      <SegmentedControl
        options={PAGES}
        value={value}
        onChange={go}
        label="เลือกหน้า"
        className="w-fit"
        buttonClassName="px-5 py-2 text-sm font-medium"
      />
    </nav>
  )
}

export default PageTabs
