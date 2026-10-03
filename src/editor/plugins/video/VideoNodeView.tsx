import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ExternalLink, Trash2, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function VideoNodeView({ node, deleteNode, selected }: NodeViewProps) {
  const src = node.attrs.src as string | undefined
  const filename = src ? src.split('/').pop()?.split('?')[0] || 'video.mp4' : 'Video'

  if (!src) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-ds-danger/30 bg-ds-danger-soft/50 text-xs text-ds-danger">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-ds-danger" />
            <span>Empty video element</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={deleteNode}
            className="h-7 text-xs text-ds-danger hover:text-ds-danger hover:bg-ds-danger-soft"
          >
            <Trash2 className="w-3.5 h-3.5 me-1" /> Remove
          </Button>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={`group relative rounded-[8px] border bg-card shadow-sm transition-all overflow-hidden ${
          selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-md bg-ds-danger/10 text-ds-danger flex items-center justify-center shrink-0">
              <Video className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-foreground">Video Asset</span>
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0 bg-ds-success/10 border-ds-success/30 text-ds-success font-medium"
            >
              ✓ Linked
            </Badge>
            <span className="text-[11px] text-muted-foreground truncate max-w-[240px]" title={src}>
              {decodeURIComponent(filename)}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => window.open(src, '_blank')}
              title="Open video in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-ds-danger hover:text-ds-danger hover:bg-ds-danger-soft"
              onClick={deleteNode}
              title="Remove video from article"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Video Player Preview */}
        <div className="relative bg-black flex items-center justify-center aspect-video max-h-[420px] overflow-hidden">
          <video
            src={src}
            controls
            preload="metadata"
            className="w-full h-full object-contain max-h-[420px]"
          />
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t text-[11px] text-muted-foreground">
          <span>✓ Interactive Preview · Full player controls active</span>
          <span>Viewers will see this video inline</span>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default VideoNodeView
