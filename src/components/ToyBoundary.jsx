import { Component } from 'react'
import { showToast } from '../lib/toast'

// Safety net around the "toys" (time machine, mini game): if one of them throws while
// rendering, only that toy closes and a toast says so. Without this, React would unmount the
// whole app and leave a blank page. (Error boundaries still have to be class components.)
class ToyBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Toy crashed:', error)
    showToast({ icon: '😵', title: 'ของเล่นพังนิดหน่อย', text: 'ปิดไปก่อนแล้ว ลองเปิดใหม่ได้เลย' })
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default ToyBoundary
