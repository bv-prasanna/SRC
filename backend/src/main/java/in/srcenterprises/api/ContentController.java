package in.srcenterprises.api;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.*;
@RestController
public class ContentController {
 private final CategoryRepository categories;
 private final MediaRepository media;
 ContentController(CategoryRepository categories,MediaRepository media){this.categories=categories;this.media=media;}
 @GetMapping("/api/catalog/categories") List<Category> categories(){return categories.findByPublishedTrueOrderByNameAsc();}
 @GetMapping("/api/catalog/media") List<MediaContent> media(){return media.findByPublishedTrueOrderByTitleAsc();}
 @GetMapping("/api/admin/categories") List<Category> adminCategories(){return categories.findAll();}
 @PostMapping("/api/admin/categories") ResponseEntity<Category> addCategory(@Valid @RequestBody Category item){item.id=null;item.version=null;var saved=categories.save(item);return ResponseEntity.created(URI.create("/api/admin/categories/"+saved.id)).body(saved);}
 @PutMapping("/api/admin/categories/{id}") Category updateCategory(@PathVariable Long id,@Valid @RequestBody Category input){var item=categories.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));item.name=input.name;item.icon=input.icon;item.published=input.published;return categories.save(item);}
 @DeleteMapping("/api/admin/categories/{id}") ResponseEntity<Void> deleteCategory(@PathVariable Long id){if(!categories.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);categories.deleteById(id);return ResponseEntity.noContent().build();}
 @GetMapping("/api/admin/media") List<MediaContent> adminMedia(){return media.findAll();}
 @PostMapping("/api/admin/media") ResponseEntity<MediaContent> addMedia(@Valid @RequestBody MediaContent input){verify(input);input.id=null;input.version=null;var saved=media.save(input);return ResponseEntity.created(URI.create("/api/admin/media/"+saved.id)).body(saved);}
 @PutMapping("/api/admin/media/{id}") MediaContent updateMedia(@PathVariable Long id,@Valid @RequestBody MediaContent input){verify(input);var existing=media.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));existing.title=input.title;existing.type=input.type;existing.url=input.url;existing.category=input.category;existing.subtitle=input.subtitle;existing.published=input.published;return media.save(existing);}
 @DeleteMapping("/api/admin/media/{id}") ResponseEntity<Void> deleteMedia(@PathVariable Long id){if(!media.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);media.deleteById(id);return ResponseEntity.noContent().build();}
 private void verify(MediaContent value){if(!Set.of("HERO","VIDEO","IMAGE").contains(value.type))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported media type");try{URI u=URI.create(value.url);if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null)throw new IllegalArgumentException();}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Media URL must use HTTPS");}}
}