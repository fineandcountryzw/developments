import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

const Dialog = ({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  
  // Debug logging
  React.useEffect(() => {
    console.log('[Dialog] State:', { isControlled, isOpen, open });
  }, [isControlled, isOpen, open]);
  
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    console.log('[Dialog] handleOpenChange:', newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
  }, [isControlled, onOpenChange]);

  // Separate trigger children from content children
  const childArray = React.Children.toArray(children);
  const triggerChild = childArray.find(
    (child) => React.isValidElement(child) && 
      ((child.type as any)?.displayName === 'DialogTrigger' || 
       (child.type as any)?.displayName === 'AlertDialogTrigger')
  );
  const contentChild = childArray.find(
    (child) => React.isValidElement(child) && 
      ((child.type as any)?.displayName === 'DialogContent' || 
       (child.type as any)?.displayName === 'AlertDialogContent')
  );
  
  // Debug: Log what children we found
  console.log('[Dialog] Children:', { 
    total: childArray.length, 
    hasTrigger: !!triggerChild, 
    hasContent: !!contentChild,
    childTypes: childArray.map(c => React.isValidElement(c) ? (c.type as any)?.displayName : 'not-element')
  });

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {/* Always render the trigger button if present */}
      {triggerChild}
      
      {/* Render overlay and content when open */}
      {isOpen && contentChild && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => handleOpenChange(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {contentChild}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn(
        'relative bg-white border border-brand-gold/20 rounded-lg shadow-forensic max-w-md w-full mx-4 p-6', 
        className
      )} 
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />
  )
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('text-sm text-gray-600', className)} {...props} />
);
DialogDescription.displayName = 'DialogDescription';

const DialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (context) {
        context.onOpenChange(false);
      }
      if (onClick) {
        onClick(e);
      }
    };
    
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 disabled:pointer-events-none',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <X className="h-4 w-4" />
      </button>
    );
  }
);
DialogClose.displayName = 'DialogClose';

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ className, children, onClick, asChild, ...props }, ref) => {
    const context = React.useContext(DialogContext);
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (context) {
        context.onOpenChange(true);
      }
      if (onClick) {
        onClick(e);
      }
    };
    
    // If asChild is true, clone the child and add the click handler
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          handleClick(e);
          // Also call the child's onClick if it exists
          const childOnClick = (children as React.ReactElement<any>).props?.onClick;
          if (childOnClick) {
            childOnClick(e);
          }
        },
      });
    }
    
    return (
      <button
        ref={ref}
        type="button"
        className={cn('', className)}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)} {...props} />
  )
);
DialogFooter.displayName = 'DialogFooter';

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose };
